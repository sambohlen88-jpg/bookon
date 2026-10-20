import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { perthToUtc, weeklyDates } from "@bookon/core";
import {
  GroupSessionClash,
  addCoachBlock,
  approveCoach,
  coachById,
  createDb,
  createGroupSessions,
  groupBookingById,
  groupSessionById,
  groupSessionWithSpots,
  saveCoachDraft,
  seed,
  setCoachPaymentAccount,
  setCoachPaymentsReady,
  setCoachTakesBookings,
  submitCoach,
  takenLessonTimes,
  type Coach,
  type DbHandle,
  type GroupSession,
} from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import { BookingProblem, type LessonContext } from "./bookings";
import { handlePaymentEvent } from "./events";
import {
  cancelGroupByGolfer,
  cancelGroupSessionByCoach,
  groupPaid,
  startGroupCheckout,
  tidyGroups,
} from "./groups";
import type { CheckoutInput, PaymentProvider } from "./provider";

// Sunday 18 October 2026, 10 am Perth.
const start = perthToUtc("2026-10-18", "10:00");
const admin = { email: "admin@bookon.test", role: "admin" as const };
const site = "https://bookon.test";
const hoursBefore = (s: GroupSession, n: number) =>
  new Date(s.startTime.getTime() - n * 60 * 60 * 1000);

let checkoutCount = 0;

class RecordingPayments implements PaymentProvider {
  readonly kind = "stripe" as const;
  moves: string[] = [];
  checkouts: (CheckoutInput & { id: string })[] = [];
  failRefunds = 0;
  async createAccount() {
    return "acct_new";
  }
  async onboardingLink() {
    return "https://connect.stripe.test";
  }
  async accountReady() {
    return true;
  }
  async dashboardLink() {
    return "https://dashboard.stripe.test";
  }
  async createCheckout(input: CheckoutInput) {
    const id = `cs_g${++checkoutCount}`;
    this.checkouts.push({ ...input, id });
    return { id, url: `https://checkout.stripe.test/${id}` };
  }
  async checkout() {
    return { status: "open" as const, paymentId: null };
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
    if (this.failRefunds > 0) {
      this.failRefunds--;
      throw new Error("Stripe is down");
    }
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

/** A clinic on a Saturday in November, one session per test so they don't share spots. */
let week = 0;
async function clinic(options: { spots?: number; minSpots?: number } = {}) {
  const date = weeklyDates("2026-11-07", 20)[week++]!;
  const [session] = await createGroupSessions(
    handle.db,
    {
      coachId: coach.id,
      title: "Beginners' clinic",
      starts: [perthToUtc(date, "14:00")],
      minutes: 60,
      place: "Range, Como",
      priceCents: 4000,
      spots: options.spots ?? 6,
      minSpots: options.minSpots ?? null,
    },
    start,
  );
  return session!;
}

function golfer(name: string) {
  return {
    golferName: name,
    golferEmail: `${name.toLowerCase()}@example.com`,
    golferPhone: "+61491570110",
  };
}

/** Book and pay through the webhook; returns the paid booking. */
async function bookAndPay(session: GroupSession, spots: number, name = "Alex", now = start) {
  await startGroupCheckout(ctx(now), { coach, session, spots, ...golfer(name) });
  const checkout = payments.checkouts.at(-1)!;
  await handlePaymentEvent(ctx(now), {
    type: "checkout.complete",
    checkoutId: checkout.id,
    paymentId: checkout.id.replace("cs_", "pi_"),
  });
  return (await groupBookingById(handle.db, checkout.bookingId))!;
}

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const draft = await saveCoachDraft(
    handle.db,
    "sam@coach.test",
    {
      name: "Sam Coach",
      headline: "Clinics",
      bio: "Group clinics.",
      specialities: ["beginners"],
      rates: [{ name: "Private lesson", minutes: 60, priceCents: 9000, people: "1" }],
      hours: [{ day: 6, from: "07:00", to: "17:00" }],
      away: [],
      places: [{ name: "Range", suburb: "Como" }],
      suburb: "Como",
      area: "south",
      contact: { phone: "+61491570159", email: "sam@coach.test" },
    },
    start,
    { by: "Sam Coach" },
  );
  await submitCoach(handle.db, draft.id, start);
  await approveCoach(handle.db, (await coachById(handle.db, draft.id))!, admin, null, start);
  await setCoachPaymentAccount(handle.db, draft.id, "acct_sam", start);
  await setCoachPaymentsReady(handle.db, "acct_sam", true, start);
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

describe("putting on sessions", () => {
  it("repeats weekly and blocks lesson times", async () => {
    const dates = weeklyDates("2027-01-09", 3);
    const made = await createGroupSessions(
      handle.db,
      {
        coachId: coach.id,
        title: "Junior squad",
        starts: dates.map((d) => perthToUtc(d, "08:00")),
        minutes: 90,
        place: "Range, Como",
        priceCents: 3500,
        spots: 10,
      },
      start,
    );
    expect(made.map((s) => s.startTime)).toEqual(dates.map((d) => perthToUtc(d, "08:00")));
    expect(new Set(made.map((s) => s.seriesId)).size).toBe(1);
    const taken = await takenLessonTimes(handle.db, coach.id, start);
    expect(taken).toContainEqual({
      start: perthToUtc("2027-01-16", "08:00"),
      end: perthToUtc("2027-01-16", "09:30"),
    });
  });

  it("refuses all the weeks if any clash with a block or another session", async () => {
    await addCoachBlock(
      handle.db,
      coach.id,
      { start: perthToUtc("2027-02-13", "09:00"), end: perthToUtc("2027-02-13", "10:00") },
      start,
    );
    const attempt = createGroupSessions(
      handle.db,
      {
        coachId: coach.id,
        title: "Clinic",
        starts: weeklyDates("2027-02-06", 3).map((d) => perthToUtc(d, "09:30")),
        minutes: 60,
        place: "Range, Como",
        priceCents: 3000,
        spots: 6,
      },
      start,
    );
    await expect(attempt).rejects.toBeInstanceOf(GroupSessionClash);
    await expect(attempt).rejects.toMatchObject({ starts: [perthToUtc("2027-02-13", "09:30")] });
  });
});

describe("booking spots", () => {
  it("charges straight away, with one booking fee for all the spots", async () => {
    const session = await clinic();
    await startGroupCheckout(ctx(), { coach, session, spots: 3, ...golfer("Alex") });
    expect(payments.checkouts[0]).toMatchObject({
      lessonCents: 12000,
      feeCents: 250,
      capture: "automatic",
      accountId: "acct_sam",
    });
    // Held at checkout.
    expect((await groupSessionWithSpots(handle.db, session.id, start))!.left).toBe(3);
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: payments.checkouts[0]!.id,
      paymentId: "pi_1",
    });
    const booking = (await groupBookingById(handle.db, payments.checkouts[0]!.bookingId))!;
    expect(booking).toMatchObject({ status: "paid", paymentId: "pi_1", spotsCents: 12000 });
    // Nothing to capture later.
    expect(payments.moves).toEqual([]);
    expect(mail.take()).toEqual([
      "alex@example.com: Booked: Beginners' clinic with Sam Coach, Sat 7 Nov, 2:00 pm",
      "sam@coach.test: Alex booked 3 spots: Beginners' clinic, Sat 7 Nov, 2:00 pm",
    ]);
    // A late second webhook does nothing.
    expect(await groupPaid(ctx(), booking.id, "pi_1")).toBeNull();
  });

  it("won't sell more spots than are left", async () => {
    const session = await clinic({ spots: 4 });
    await bookAndPay(session, 3);
    await expect(
      startGroupCheckout(ctx(), { coach, session, spots: 2, ...golfer("Bo") }),
    ).rejects.toThrow(new BookingProblem("Sorry, only 1 spot is left now."));
    await bookAndPay(session, 1, "Bo");
    await expect(
      startGroupCheckout(ctx(), { coach, session, spots: 1, ...golfer("Cy") }),
    ).rejects.toThrow("Sorry, this session has just filled up.");
  });
});

describe("cancelling", () => {
  it("refunds a golfer who cancels 24 hours or more before", async () => {
    const session = await clinic();
    const booking = await bookAndPay(session, 2);
    mail.take();
    const cancelled = await cancelGroupByGolfer(ctx(hoursBefore(session, 25)), booking);
    expect(cancelled).toMatchObject({
      status: "cancelled",
      refundCents: 8250,
      cancelledBy: "golfer",
    });
    expect(payments.moves).toEqual([`refund ${booking.paymentId}`]);
    expect((await groupSessionWithSpots(handle.db, session.id, start))!.left).toBe(6);
    expect(mail.take()).toHaveLength(2);
  });

  it("doesn't refund a late cancel, but frees the spots", async () => {
    const session = await clinic();
    const booking = await bookAndPay(session, 1);
    const cancelled = await cancelGroupByGolfer(ctx(hoursBefore(session, 3)), booking);
    expect(cancelled).toMatchObject({ status: "cancelled", refundCents: 0 });
    expect(payments.moves).toEqual([]);
  });

  it("refunds everyone when the coach cancels", async () => {
    const session = await clinic();
    const a = await bookAndPay(session, 2, "Alex");
    const b = await bookAndPay(session, 1, "Bo");
    mail.take();
    const result = await cancelGroupSessionByCoach(ctx(), session, "Course closed for works");
    expect(result).toEqual({ refunded: 2 });
    expect(payments.moves).toEqual([`refund ${a.paymentId}`, `refund ${b.paymentId}`]);
    expect((await groupBookingById(handle.db, a.id))!).toMatchObject({
      status: "cancelled",
      cancelledBy: "coach",
      refundCents: 8250,
    });
    expect(mail.take()).toEqual([
      expect.stringMatching(/^alex@example.com: Called off: Beginners' clinic, Sat /),
      expect.stringMatching(/^bo@example.com: Called off: Beginners' clinic, Sat /),
    ]);
    expect(await cancelGroupSessionByCoach(ctx(), session, null)).toBeNull();
  });

  it("tries a failed refund again on the next tidy", async () => {
    const session = await clinic();
    const booking = await bookAndPay(session, 1);
    payments.failRefunds = 1;
    expect(await cancelGroupSessionByCoach(ctx(), session, null)).toEqual({ refunded: 0 });
    expect((await groupBookingById(handle.db, booking.id))!.status).toBe("paid");
    const tidy = await tidyGroups(ctx());
    expect(tidy.refunded).toBe(1);
    expect((await groupBookingById(handle.db, booking.id))!.status).toBe("cancelled");
  });

  it("refunds straight away if they pay after it's called off", async () => {
    const session = await clinic();
    await startGroupCheckout(ctx(), { coach, session, spots: 1, ...golfer("Alex") });
    await cancelGroupSessionByCoach(ctx(), session, null);
    const checkout = payments.checkouts.at(-1)!;
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: checkout.id,
      paymentId: "pi_late",
    });
    expect((await groupBookingById(handle.db, checkout.bookingId))!).toMatchObject({
      status: "cancelled",
      refundCents: 4250,
    });
    expect(payments.moves).toEqual(["refund pi_late"]);
  });
});

describe("minimum numbers", () => {
  it("calls off a session short of its minimum 24 hours before, and refunds", async () => {
    const short = await clinic({ minSpots: 3 });
    const booking = await bookAndPay(short, 2);
    mail.take();
    // Not yet: 25 hours before.
    await tidyGroups(ctx(hoursBefore(short, 25)));
    expect((await groupSessionById(handle.db, short.id))!.status).toBe("open");
    const tidy = await tidyGroups(ctx(hoursBefore(short, 23.9)));
    expect(tidy).toMatchObject({ calledOff: 1, refunded: 0 });
    expect((await groupSessionById(handle.db, short.id))!).toMatchObject({
      status: "cancelled",
      cancelledBy: "minimum",
    });
    expect((await groupBookingById(handle.db, booking.id))!).toMatchObject({
      status: "cancelled",
      cancelledBy: "minimum",
      refundCents: 8250,
    });
    expect(mail.take()).toEqual([
      expect.stringMatching(/^alex@example.com: Called off/),
      expect.stringMatching(/^sam@coach.test: Called off/),
    ]);
  });

  it("goes ahead when the minimum is reached, and isn't checked again", async () => {
    const full = await clinic({ minSpots: 2 });
    const booking = await bookAndPay(full, 2);
    mail.take();
    expect(await tidyGroups(ctx(hoursBefore(full, 23)))).toMatchObject({ goingAhead: 1 });
    expect(mail.take()).toEqual([expect.stringMatching(/^sam@coach.test: Going ahead/)]);
    // A late cancel afterwards doesn't call it off.
    await cancelGroupByGolfer(ctx(hoursBefore(full, 5)), booking);
    expect(await tidyGroups(ctx(hoursBefore(full, 4)))).toMatchObject({
      calledOff: 0,
      goingAhead: 0,
    });
    expect((await groupSessionById(handle.db, full.id))!.status).toBe("open");
  });
});
