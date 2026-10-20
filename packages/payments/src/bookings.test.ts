import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import {
  approveCoach,
  coachById,
  createDb,
  lessonById,
  markLessonAbandoned,
  saveCoachDraft,
  seed,
  setCoachPaymentAccount,
  setCoachPaymentsReady,
  setCoachTakesBookings,
  setLessonPaymentSettings,
  staleLessonCheckouts,
  submitCoach,
  takenLessonTimes,
  type Coach,
  type DbHandle,
} from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import {
  BookingProblem,
  acceptLessonRequest,
  cancelLessonByCoach,
  cancelLessonByGolfer,
  checkLessonCheckout,
  coachPaymentsSetupLink,
  coachTakesBookings,
  declineLessonRequest,
  lessonPaid,
  startLessonCheckout,
  tidyLessons,
  type LessonContext,
} from "./bookings";
import { handlePaymentEvent } from "./events";
import type { CheckoutInput, CheckoutState, PaymentProvider } from "./provider";

// Sunday 18 October 2026, 10 am Perth.
const start = perthToUtc("2026-10-18", "10:00");
const admin = { email: "admin@bookon.test", role: "admin" as const };
const site = "https://bookon.test";
const hours = (n: number) => new Date(start.getTime() + n * 60 * 60 * 1000);

/** Checkouts across all tests, as Stripe would keep them. */
const states = new Map<string, CheckoutState>();
let checkoutCount = 0;

/** Stands in for Stripe, recording every money movement. */
class RecordingPayments implements PaymentProvider {
  readonly kind = "stripe" as const;
  moves: string[] = [];
  checkouts: (CheckoutInput & { id: string })[] = [];
  async createAccount() {
    return "acct_new";
  }
  async onboardingLink(accountId: string) {
    return `https://connect.stripe.test/${accountId}`;
  }
  async accountReady() {
    return true;
  }
  async dashboardLink() {
    return "https://dashboard.stripe.test";
  }
  async createCheckout(input: CheckoutInput) {
    const id = `cs_${++checkoutCount}`;
    this.checkouts.push({ ...input, id });
    states.set(id, { status: "open", paymentId: null });
    return { id, url: `https://checkout.stripe.test/${id}` };
  }
  async checkout(id: string) {
    return states.get(id) ?? { status: "expired" as const, paymentId: null };
  }
  async expireCheckout(id: string) {
    this.moves.push(`expire ${id}`);
  }
  async capture(id: string) {
    this.moves.push(`capture ${id}`);
  }
  async release(id: string) {
    this.moves.push(`release ${id}`);
  }
  async refund(id: string) {
    this.moves.push(`refund ${id}`);
  }
  readWebhook(): never {
    throw new Error("not used");
  }
}

class Inbox implements Mailer {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
  take() {
    const all = this.sent.map((m) => `${m.to}: ${m.subject}`);
    this.sent = [];
    return all;
  }
}

let handle: DbHandle;
let coach: Coach;
let payments: RecordingPayments;
let mail: Inbox;

function ctx(now = start): LessonContext {
  return { db: handle.db, payments, mailer: mail, site, now };
}

async function freshCoach(): Promise<Coach> {
  return (await coachById(handle.db, coach.id))!;
}

function request(time: string, date = "2026-10-24") {
  return {
    rateIndex: 0,
    startTime: perthToUtc(date, time),
    place: "Range, Como",
    golferName: "Alex Golfer",
    golferEmail: "alex@example.com",
    golferPhone: "+61491570110",
    note: "First lesson in years",
  };
}

/** Book and pay: returns the booking once the card is held. */
async function bookAndPay(time: string, date?: string) {
  await startLessonCheckout(ctx(), { coach: await freshCoach(), ...request(time, date) });
  const checkout = payments.checkouts.at(-1)!;
  const paymentId = checkout.id.replace("cs_", "pi_");
  states.set(checkout.id, { status: "complete", paymentId });
  await handlePaymentEvent(ctx(), {
    type: "checkout.complete",
    checkoutId: checkout.id,
    paymentId,
  });
  mail.take();
  return (await lessonById(handle.db, checkout.bookingId))!;
}

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const draft = await saveCoachDraft(
    handle.db,
    "jo@coach.test",
    {
      name: "Jo Coach",
      headline: "All-round",
      bio: "Lessons for everyone.",
      specialities: ["all-round"],
      rates: [
        { name: "Private lesson", minutes: 60, priceCents: 9000, people: "1" },
        { name: "Clinic", minutes: 60, priceCents: 3000, people: "group" },
      ],
      // Saturdays 7 am to 12 pm.
      hours: [{ day: 6, from: "07:00", to: "12:00" }],
      away: [],
      places: [{ name: "Range", suburb: "Como" }],
      suburb: "Como",
      area: "south",
      contact: { phone: "+61491570159", email: "jo@coach.test" },
    },
    start,
    { by: "Jo Coach" },
  );
  await submitCoach(handle.db, draft.id, start);
  await approveCoach(handle.db, (await coachById(handle.db, draft.id))!, admin, null, start);
  await setCoachPaymentAccount(handle.db, draft.id, "acct_jo", start);
  await setCoachPaymentsReady(handle.db, "acct_jo", true, start);
  await setCoachTakesBookings(handle.db, draft.id, true, start);
  coach = (await coachById(handle.db, draft.id))!;
});
afterAll(async () => {
  await handle.close();
});
beforeEach(() => {
  payments = new RecordingPayments();
  mail = new Inbox();
});

describe("booking a lesson", () => {
  it("holds the card at checkout, then asks the coach", async () => {
    const url = await startLessonCheckout(ctx(), {
      coach: await freshCoach(),
      ...request("09:00"),
    });
    const checkout = payments.checkouts[0]!;
    expect(url).toBe(`https://checkout.stripe.test/${checkout.id}`);
    expect(checkout).toMatchObject({
      lessonCents: 9000,
      feeCents: 250,
      accountId: "acct_jo",
      email: "alex@example.com",
      description: "Private lesson, 60 min with Jo Coach, Sat 24 Oct, 9:00 am",
    });
    expect(checkout.successUrl).toMatch(/^https:\/\/bookon\.test\/lessons\/[\w-]+\?paid=1$/);
    // Nothing to email until it's paid.
    expect(mail.take()).toEqual([]);

    // Back from Stripe before the webhook: BookOn asks Stripe itself.
    states.set(checkout.id, { status: "complete", paymentId: "pi_first" });
    const booking = (await lessonById(handle.db, checkout.bookingId))!;
    const checked = await checkLessonCheckout(ctx(), booking);
    expect(checked.status).toBe("requested");
    expect(mail.take()).toEqual([
      "alex@example.com: Lesson request sent to Jo Coach",
      "jo@coach.test: Lesson request: Alex Golfer, Sat 24 Oct, 9:00 am",
    ]);
    // The webhook arriving later changes nothing and sends nothing.
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: checkout.id,
      paymentId: "pi_first",
    });
    expect(mail.take()).toEqual([]);
    // Withdrawn, so it doesn't lapse in later tests.
    await cancelLessonByGolfer(ctx(), checked);
  });

  it("won't take a time that's held, outside the coach's hours, or a group clinic", async () => {
    const c = await freshCoach();
    await startLessonCheckout(ctx(), { coach: c, ...request("09:00") });
    await expect(startLessonCheckout(ctx(), { coach: c, ...request("09:30") })).rejects.toThrow(
      "that time isn't free any more",
    );
    await markLessonAbandoned(handle.db, payments.checkouts[0]!.bookingId);
    await expect(startLessonCheckout(ctx(), { coach: c, ...request("13:00") })).rejects.toThrow(
      BookingProblem,
    );
    await expect(
      startLessonCheckout(ctx(), { coach: c, ...request("07:00"), rateIndex: 1 }),
    ).rejects.toThrow("Pick a lesson.");
    await expect(
      startLessonCheckout(ctx(), { coach: c, ...request("07:00"), place: "Somewhere else" }),
    ).rejects.toThrow("Pick where");
  });

  it("is off when an admin turns lesson payments off", async () => {
    await setLessonPaymentSettings(handle.db, { enabled: false, feeCents: 250 }, admin, start);
    expect(await coachTakesBookings(ctx(), await freshCoach())).toBe(false);
    await expect(
      startLessonCheckout(ctx(), { coach: await freshCoach(), ...request("07:00") }),
    ).rejects.toThrow("isn't taking bookings");
    await setLessonPaymentSettings(handle.db, { enabled: true, feeCents: 300 }, admin, start);
  });

  it("uses the booking fee set in admin", async () => {
    await startLessonCheckout(ctx(), { coach: await freshCoach(), ...request("07:00") });
    expect(payments.checkouts[0]!.feeCents).toBe(300);
    await setLessonPaymentSettings(handle.db, { enabled: true, feeCents: 250 }, admin, start);
  });

  it("frees the time when a checkout isn't paid, and records it when it was", async () => {
    // The 7 am checkout from the last test was never paid. This 11 am one is paid just before it closes.
    const [unpaid] = await staleLessonCheckouts(handle.db, hours(1));
    await startLessonCheckout(ctx(), { coach: await freshCoach(), ...request("11:00") });
    const paid = payments.checkouts[0]!;
    states.set(paid.id, { status: "complete", paymentId: "pi_late" });
    expect(await tidyLessons(ctx(hours(1)))).toEqual({ closed: 2, lapsed: 0 });
    expect(payments.moves).toEqual([`expire ${unpaid!.checkoutId}`]);
    expect((await lessonById(handle.db, unpaid!.id))?.status).toBe("abandoned");
    expect((await lessonById(handle.db, paid.bookingId))?.status).toBe("requested");
    expect(mail.take()).toHaveLength(2);
    // 7 am is free again; 11 am is held.
    const taken = (await takenLessonTimes(handle.db, coach.id, hours(1))).map((t) =>
      t.start.getTime(),
    );
    expect(taken).not.toContain(perthToUtc("2026-10-24", "07:00").getTime());
    expect(taken).toContain(perthToUtc("2026-10-24", "11:00").getTime());
    await declineLessonRequest(ctx(), (await lessonById(handle.db, paid.bookingId))!, null);
  });
});

describe("the coach answers", () => {
  it("accepting charges the card and confirms with the golfer", async () => {
    const booking = await bookAndPay("08:00", "2026-10-31");
    const accepted = await acceptLessonRequest(ctx(), booking);
    expect(accepted?.status).toBe("confirmed");
    expect(payments.moves).toEqual([`capture ${booking.paymentId}`]);
    expect(mail.take()).toEqual([
      "alex@example.com: Booked: Private lesson, 60 min with Jo Coach, Sat 31 Oct, 8:00 am",
    ]);
    // Accepting twice does nothing.
    expect(await acceptLessonRequest(ctx(), accepted!)).toBeNull();
    expect(payments.moves).toHaveLength(1);
  });

  it("declining releases the hold and tells the golfer", async () => {
    const booking = await bookAndPay("09:00", "2026-10-31");
    const declined = await declineLessonRequest(ctx(), booking, "Away that weekend");
    expect(declined?.status).toBe("declined");
    expect(payments.moves).toEqual([`release ${booking.paymentId}`]);
    const [email] = mail.sent;
    expect(email?.subject).toBe("Jo Coach can't do Sat 31 Oct, 9:00 am");
    expect(email?.text).toContain('Jo Coach says: "Away that weekend"');
  });

  it("no answer in 48 hours lapses the request and releases the hold", async () => {
    const booking = await bookAndPay("10:00", "2026-10-31");
    expect(await tidyLessons(ctx(hours(47)))).toEqual({ closed: 0, lapsed: 0 });
    expect(await tidyLessons(ctx(hours(48)))).toEqual({ closed: 0, lapsed: 1 });
    expect(payments.moves).toEqual([`release ${booking.paymentId}`]);
    expect(mail.take()).toEqual([
      "alex@example.com: Your lesson request to Jo Coach has lapsed",
      "jo@coach.test: Lesson request lapsed: Alex Golfer, Sat 31 Oct, 10:00 am",
    ]);
    await expect(acceptLessonRequest(ctx(hours(48)), booking)).rejects.toThrow();
  });
});

describe("cancelling", () => {
  it("a golfer withdrawing a request releases the hold", async () => {
    const booking = await bookAndPay("07:00", "2026-11-07");
    const cancelled = await cancelLessonByGolfer(ctx(), booking);
    expect(cancelled).toMatchObject({ status: "cancelled", refundCents: 0 });
    expect(payments.moves).toEqual([`release ${booking.paymentId}`]);
    expect(mail.take()).toEqual([
      "alex@example.com: Lesson cancelled: Sat 7 Nov, 7:00 am with Jo Coach",
      "jo@coach.test: Alex Golfer cancelled Sat 7 Nov, 7:00 am",
    ]);
  });

  it("a golfer cancelling 24 hours or more before gets everything back", async () => {
    const booking = (await acceptLessonRequest(ctx(), await bookAndPay("08:00", "2026-11-07")))!;
    payments.moves = [];
    const cancelled = await cancelLessonByGolfer(ctx(), booking);
    expect(cancelled?.refundCents).toBe(9250);
    expect(payments.moves).toEqual([`refund ${booking.paymentId}`]);
  });

  it("a golfer cancelling later isn't refunded, and the coach keeps the lesson price", async () => {
    const booking = (await acceptLessonRequest(ctx(), await bookAndPay("09:00", "2026-11-07")))!;
    payments.moves = [];
    mail.take();
    const lateNow = new Date(booking.startTime.getTime() - 23 * 60 * 60 * 1000);
    const cancelled = await cancelLessonByGolfer(ctx(lateNow), booking);
    expect(cancelled?.refundCents).toBe(0);
    expect(payments.moves).toEqual([]);
    expect(mail.sent[1]?.text).toContain("you keep the $90");
  });

  it("a coach cancelling refunds the golfer in full", async () => {
    const booking = (await acceptLessonRequest(ctx(), await bookAndPay("10:00", "2026-11-07")))!;
    payments.moves = [];
    mail.take();
    const cancelled = await cancelLessonByCoach(ctx(), booking, "Course closed for a tournament");
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelledBy: "coach",
      refundCents: 9250,
    });
    expect(payments.moves).toEqual([`refund ${booking.paymentId}`]);
    expect(mail.take()).toEqual([
      "alex@example.com: Jo Coach cancelled your lesson on Sat 7 Nov, 10:00 am",
    ]);
  });
});

describe("special rates", () => {
  it("charge the coach's weekend price on a Saturday, and say so on the booking", async () => {
    const { schema } = await import("@bookon/db");
    const { eq } = await import("drizzle-orm");
    const before = (await freshCoach()).profile!;
    const weekend = {
      ...before,
      rates: [{ ...before.rates[0]!, weekendCents: 11000 }, ...before.rates.slice(1)],
    };
    await handle.db
      .update(schema.coaches)
      .set({ profile: weekend })
      .where(eq(schema.coaches.id, coach.id));
    await startLessonCheckout(ctx(), {
      coach: await freshCoach(),
      ...request("11:00", "2026-11-14"),
    });
    const checkout = payments.checkouts.at(-1)!;
    expect(checkout.lessonCents).toBe(11000);
    const booking = (await lessonById(handle.db, checkout.bookingId))!;
    expect(booking.rate).toMatchObject({ priceCents: 11000, charged: "weekend" });
    await markLessonAbandoned(handle.db, booking.id);
    await handle.db
      .update(schema.coaches)
      .set({ profile: before })
      .where(eq(schema.coaches.id, coach.id));
  });
});

describe("coach payment accounts", () => {
  it("make a new account the first time, and keep it after", async () => {
    const fresh = { ...(await freshCoach()), paymentAccountId: null };
    const urls = { returnUrl: `${site}/coach`, refreshUrl: `${site}/coach` };
    expect(await coachPaymentsSetupLink(ctx(), fresh, urls)).toBe(
      "https://connect.stripe.test/acct_new",
    );
    expect((await freshCoach()).paymentAccountId).toBe("acct_new");
    expect(await coachPaymentsSetupLink(ctx(), await freshCoach(), urls)).toBe(
      "https://connect.stripe.test/acct_new",
    );
  });

  it("stop bookings when Stripe says the account can't take payments", async () => {
    await handlePaymentEvent(ctx(), {
      type: "account.updated",
      accountId: "acct_new",
      ready: false,
    });
    expect(await coachTakesBookings(ctx(), await freshCoach())).toBe(false);
    await handlePaymentEvent(ctx(), {
      type: "account.updated",
      accountId: "acct_new",
      ready: true,
    });
    await setCoachTakesBookings(handle.db, coach.id, true, start);
    expect(await coachTakesBookings(ctx(), await freshCoach())).toBe(true);
  });
});

describe("paying twice", () => {
  it("only sends the request once", async () => {
    const booking = await bookAndPay("11:00", "2026-11-07");
    expect(await lessonPaid(ctx(), booking.id, booking.paymentId!)).toBeNull();
    expect(mail.sent).toEqual([]);
  });
});
