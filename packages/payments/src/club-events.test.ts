import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { perthToUtc } from "@bookon/core";
import {
  acceptEventTerms,
  addClubMember,
  buildStartSheetFor,
  clubById,
  createDb,
  createEvent,
  entryById,
  eventById,
  joinWaitlist,
  schema,
  seed,
  setClubPaymentAccount,
  setClubPaymentsReady,
  type ClubEvent,
  type DbHandle,
  type EventInput,
} from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import { BookingProblem, type LessonContext } from "./bookings";
import {
  cancelEventByClub,
  clubTakesEntries,
  moveEntryAndTell,
  publishStartSheetAndTell,
  startEntryCheckout,
  tidyEvents,
  withdrawEntryByClub,
  withdrawEntryByGolfer,
} from "./club-events";
import { handlePaymentEvent } from "./events";
import type { CheckoutInput, PaymentProvider } from "./provider";

const now = perthToUtc("2026-10-23", "09:00");
const actor = { email: "pat@club.test", role: "club" as const };
const site = "https://bookon.test";
let checkoutCount = 0;

class RecordingPayments implements PaymentProvider {
  readonly kind = "stripe" as const;
  moves: string[] = [];
  checkouts: (CheckoutInput & { id: string })[] = [];
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
    const id = `cs_e${++checkoutCount}`;
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
let clubId: string;
let courseId: string;
let payments: RecordingPayments;
let mail: Inbox;

function ctx(at = now): LessonContext {
  return { db: handle.db, payments, mailer: mail, site, now: at };
}

const input = (over: Partial<EventInput> = {}): EventInput => ({
  courseId,
  title: "Spring Ambrose",
  description: null,
  date: "2026-11-14",
  holes: 18,
  startType: "tees",
  firstStart: perthToUtc("2026-11-14", "07:00"),
  intervalMinutes: 10,
  twoTees: false,
  teamSize: 2,
  feeCents: 4500,
  memberFeeCents: 3000,
  maxPlayers: 6,
  entriesClose: perthToUtc("2026-11-12", "17:00"),
  open: true,
  ...over,
});

async function freshEvent(over: Partial<EventInput> = {}) {
  return createEvent(handle.db, clubId, input(over), actor, now);
}

/** Enter and pay through the webhook. */
async function enterAndPay(event: ClubEvent, name: string, at = now) {
  await startEntryCheckout(ctx(at), {
    event,
    players: [{ name, memberNumber: "M1" }, { name: `${name}'s mate` }],
    contactName: name,
    contactEmail: `${name.toLowerCase()}@example.com`,
    contactPhone: "+61491570110",
  });
  const checkout = payments.checkouts.at(-1)!;
  await handlePaymentEvent(ctx(at), {
    type: "checkout.complete",
    checkoutId: checkout.id,
    paymentId: checkout.id.replace("cs_", "pi_"),
  });
  return (await entryById(handle.db, checkout.bookingId))!;
}

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const [course] = await handle.db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, "collier-park"));
  courseId = course!.id;
  clubId = course!.clubId;
  await addClubMember(handle.db, clubId, "pat@club.test", "owner", actor, now);
});
afterAll(async () => {
  await handle.close();
});
beforeEach(() => {
  payments = new RecordingPayments();
  mail = new Inbox();
});

describe("club payments", () => {
  it("takes entries only once Stripe is ready and the owner has agreed", async () => {
    expect(await clubTakesEntries(ctx(), (await clubById(handle.db, clubId))!)).toBe(false);
    await setClubPaymentAccount(handle.db, clubId, "acct_club", now);
    await setClubPaymentsReady(handle.db, "acct_club", true, now);
    expect(await clubTakesEntries(ctx(), (await clubById(handle.db, clubId))!)).toBe(false);
    await acceptEventTerms(handle.db, clubId, "Pat Owner", actor, now);
    expect(await clubTakesEntries(ctx(), (await clubById(handle.db, clubId))!)).toBe(true);
  });
});

describe("entering", () => {
  it("charges the team's fees to the club straight away, with one booking fee", async () => {
    const event = await freshEvent();
    const entry = await enterAndPay(event, "Alex");
    expect(payments.checkouts[0]).toMatchObject({
      lessonCents: 7500,
      feeCents: 250,
      capture: "automatic",
      accountId: "acct_club",
    });
    expect(entry).toMatchObject({ status: "paid", feesCents: 7500 });
    expect(mail.take()).toEqual([
      "alex@example.com: Entered: Spring Ambrose, Sat 14 Nov",
      "pat@club.test: New entry: Spring Ambrose, Alex",
    ]);
  });

  it("needs every player's name, and member numbers for members-only events", async () => {
    const event = await freshEvent();
    await expect(
      startEntryCheckout(ctx(), {
        event,
        players: [{ name: "Solo" }],
        contactName: "Solo",
        contactEmail: "solo@example.com",
        contactPhone: "+61491570110",
      }),
    ).rejects.toThrow(new BookingProblem("Add all 2 players' names (pairs)."));
    const members = await freshEvent({ open: false });
    await expect(
      startEntryCheckout(ctx(), {
        event: members,
        players: [{ name: "A", memberNumber: "1" }, { name: "B" }],
        contactName: "A",
        contactEmail: "a@example.com",
        contactPhone: "+61491570110",
      }),
    ).rejects.toThrow("members only");
  });
});

describe("withdrawing", () => {
  it("refunds a golfer in full before entries close, and tells the waiting list", async () => {
    const event = await freshEvent({ maxPlayers: 2 });
    const entry = await enterAndPay(event, "Bo");
    await joinWaitlist(
      handle.db,
      { eventId: event.id, name: "Kim", email: "kim@example.com", players: 2 },
      now,
    );
    mail.take();
    const ended = await withdrawEntryByGolfer(ctx(), entry);
    expect(ended).toMatchObject({ status: "withdrawn", refundCents: 7750, cancelledBy: "golfer" });
    expect(payments.moves).toEqual([`refund ${entry.paymentId}`]);
    expect(mail.take()).toEqual([
      "bo@example.com: Withdrawn: Spring Ambrose, Sat 14 Nov",
      "pat@club.test: Withdrawn: Spring Ambrose, Bo",
      "kim@example.com: A place is free: Spring Ambrose, Sat 14 Nov",
    ]);
  });

  it("doesn't refund after entries close, unless the club does", async () => {
    const event = await freshEvent();
    const a = await enterAndPay(event, "Cy");
    const b = await enterAndPay(event, "Di");
    const afterClose = perthToUtc("2026-11-13", "09:00");
    expect(await withdrawEntryByGolfer(ctx(afterClose), a)).toMatchObject({ refundCents: 0 });
    expect(payments.moves).toEqual([]);
    const byClub = await withdrawEntryByClub(ctx(afterClose), b, { refund: true, note: "Sorry" });
    expect(byClub).toMatchObject({ cancelledBy: "club", refundCents: 7750 });
    expect(payments.moves).toEqual([`refund ${b.paymentId}`]);
  });
});

describe("cancelling an event", () => {
  it("refunds everyone, and anyone who pays afterwards", async () => {
    const event = await freshEvent();
    const a = await enterAndPay(event, "Ed");
    await startEntryCheckout(ctx(), {
      event,
      players: [{ name: "Late" }, { name: "Mate" }],
      contactName: "Late",
      contactEmail: "late@example.com",
      contactPhone: "+61491570110",
    });
    mail.take();
    expect(await cancelEventByClub(ctx(), event, "Course flooded", actor)).toEqual({ refunded: 1 });
    const late = payments.checkouts.at(-1)!;
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: late.id,
      paymentId: "pi_late",
    });
    expect(payments.moves).toEqual([`refund ${a.paymentId}`, "refund pi_late"]);
    expect(mail.take()).toEqual([
      "ed@example.com: Cancelled: Spring Ambrose, Sat 14 Nov",
      "late@example.com: Cancelled: Spring Ambrose, Sat 14 Nov",
    ]);
  });
});

describe("start sheet", () => {
  it("emails everyone their start, and only the moved team after that", async () => {
    const event = await freshEvent({ maxPlayers: 8 });
    // Paid a minute apart, so the start sheet follows entry order.
    const minute = (n: number) => new Date(now.getTime() + n * 60_000);
    await enterAndPay(event, "Fi", minute(1));
    await enterAndPay(event, "Gus", minute(2));
    const c = await enterAndPay(event, "Hal", minute(3));
    await buildStartSheetFor(handle.db, event, false);
    mail.take();
    expect(await publishStartSheetAndTell(ctx(), event, actor)).toBe(3);
    expect(mail.take()).toEqual([
      "fi@example.com: Your start time: Spring Ambrose, 7:00 am, 1st tee",
      "gus@example.com: Your start time: Spring Ambrose, 7:00 am, 1st tee",
      "hal@example.com: Your start time: Spring Ambrose, 7:10 am, 1st tee",
    ]);
    const published = (await eventById(handle.db, event.id))!;
    await moveEntryAndTell(ctx(), published, c.id, 3);
    expect(mail.take()).toEqual([
      "hal@example.com: New start time: Spring Ambrose, 7:20 am, 1st tee",
    ]);
  });
});

describe("worker", () => {
  it("tells the club when entries close, and reminds entrants the day before, once each", async () => {
    const event = await freshEvent({
      firstStart: perthToUtc("2026-10-25", "07:00"),
      entriesClose: perthToUtc("2026-10-24", "12:00"),
      date: "2026-10-25",
    });
    await enterAndPay(event, "Ivy");
    mail.take();
    const evening = perthToUtc("2026-10-24", "18:00");
    const first = await tidyEvents(ctx(evening));
    expect(first.notices).toBeGreaterThanOrEqual(1);
    expect(first.reminders).toBeGreaterThanOrEqual(1);
    const sent = mail.take();
    expect(sent).toContain("pat@club.test: Entries closed: Spring Ambrose, Sun 25 Oct");
    expect(sent).toContain("ivy@example.com: Reminder: Spring Ambrose, Sun 25 Oct");
    const again = await tidyEvents(ctx(evening));
    expect(again).toMatchObject({ notices: 0, reminders: 0 });
  });
});
