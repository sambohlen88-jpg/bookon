import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { perthToUtc } from "@bookon/core";
import {
  acceptEventTerms,
  addClubEntry,
  addClubMember,
  compById,
  createComp,
  createDb,
  makeDraw,
  matchesForComp,
  mpEntryById,
  schema,
  seed,
  setClubPaymentAccount,
  setClubPaymentsReady,
  setRoundDates,
  type CompInput,
  type DbHandle,
  type MatchplayComp,
  type MatchplayMatch,
} from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import type { LessonContext } from "./bookings";
import { handlePaymentEvent } from "./events";
import {
  cancelCompByClub,
  clubResultAndTell,
  confirmAndTell,
  disputeAndTell,
  publishDrawAndTell,
  reportAndTell,
  startMpEntry,
  tidyMatchplay,
  withdrawMpByGolfer,
} from "./matchplay";
import type { CheckoutInput, PaymentProvider } from "./provider";

const now = perthToUtc("2026-10-24", "09:00");
const actor = { email: "pro@club.test", role: "club" as const };
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
    const id = `cs_m${++checkoutCount}`;
    this.checkouts.push({ ...input, id });
    return { id, url: `https://checkout.stripe.test/${id}` };
  }
  async checkout() {
    return { status: "open" as const, paymentId: null };
  }
  async expireCheckout() {}
  async capture() {}
  async release() {}
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

async function comp(over: Partial<CompInput> = {}): Promise<MatchplayComp> {
  return createComp(
    handle.db,
    clubId,
    {
      courseId,
      title: "Club Matchplay",
      description: null,
      teamSize: 1,
      onlineEntry: true,
      feeCents: 0,
      maxEntries: 16,
      entriesClose: null,
      open: true,
      ...over,
    },
    actor,
    now,
  );
}

async function add(c: MatchplayComp, name: string) {
  return addClubEntry(
    handle.db,
    (await compById(handle.db, c.id))!,
    {
      players: [{ name }],
      contactEmail: `${name.toLowerCase()}@example.com`,
      contactPhone: "+61491570110",
    },
    actor,
    now,
  );
}

const at = (ms: MatchplayMatch[], round: number, slot: number) =>
  ms.find((m) => m.round === round && m.slot === slot)!;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const [course] = await handle.db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, "point-walter"));
  courseId = course!.id;
  clubId = course!.clubId;
  await addClubMember(handle.db, clubId, "pro@club.test", "owner", actor, now);
  await setClubPaymentAccount(handle.db, clubId, "acct_pw", now);
  await setClubPaymentsReady(handle.db, "acct_pw", true, now);
  await acceptEventTerms(handle.db, clubId, "Pat Pro", actor, now);
});
afterAll(async () => {
  await handle.close();
});
beforeEach(() => {
  payments = new RecordingPayments();
  mail = new Inbox();
});

describe("entering", () => {
  it("puts free entries straight in and tells the club", async () => {
    const c = await comp();
    const next = await startMpEntry(ctx(), {
      comp: c,
      players: [{ name: "Alex" }],
      contactEmail: "alex@example.com",
      contactPhone: "+61491570110",
    });
    expect(next).toMatch(/\/matchplay\/entry\/.+\?entered=1$/);
    expect(payments.checkouts).toEqual([]);
    expect(mail.take()).toEqual([
      "alex@example.com: Entered: Club Matchplay",
      "pro@club.test: New entry: Club Matchplay, Alex",
    ]);
  });

  it("charges paid entries to the club, per player, and refunds a withdrawal before the draw", async () => {
    const c = await comp({ teamSize: 2, feeCents: 2000 });
    await startMpEntry(ctx(), {
      comp: c,
      players: [{ name: "Bo" }, { name: "Cy" }],
      contactEmail: "bo@example.com",
      contactPhone: "+61491570110",
    });
    const checkout = payments.checkouts[0]!;
    expect(checkout).toMatchObject({ lessonCents: 4000, feeCents: 250, capture: "automatic" });
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: checkout.id,
      paymentId: "pi_bo",
    });
    const entry = (await mpEntryById(handle.db, checkout.bookingId))!;
    expect(entry.status).toBe("entered");
    mail.take();
    const ended = await withdrawMpByGolfer(ctx(), entry);
    expect(ended).toMatchObject({ status: "withdrawn", refundCents: 4250 });
    expect(payments.moves).toEqual(["refund pi_bo"]);
    expect(mail.take()).toEqual(["bo@example.com: Withdrawn: Club Matchplay"]);
  });

  it("refunds everyone when the club cancels", async () => {
    const c = await comp({ feeCents: 1500 });
    await startMpEntry(ctx(), {
      comp: c,
      players: [{ name: "Di" }],
      contactEmail: "di@example.com",
      contactPhone: "+61491570110",
    });
    await handlePaymentEvent(ctx(), {
      type: "checkout.complete",
      checkoutId: payments.checkouts[0]!.id,
      paymentId: "pi_di",
    });
    await add(c, "Ed");
    mail.take();
    expect(await cancelCompByClub(ctx(), c, "Not enough entries", actor)).toEqual({ told: 2 });
    expect(payments.moves).toEqual(["refund pi_di"]);
    expect(mail.take().sort()).toEqual([
      "di@example.com: Cancelled: Club Matchplay",
      "ed@example.com: Cancelled: Club Matchplay",
    ]);
  });
});

describe("playing", () => {
  it("emails the draw, results, disputes and the next match", async () => {
    const c = await comp();
    const [a, b, cc] = [await add(c, "Fay"), await add(c, "Gil"), await add(c, "Hal")];
    const drawn = await makeDraw(handle.db, c, (x) => x, now);
    await setRoundDates(handle.db, drawn, ["2026-11-08", "2026-11-22"], now);
    mail.take();
    // Fay (first in) has a bye; Gil plays Hal.
    await publishDrawAndTell(ctx(), (await compById(handle.db, c.id))!, actor);
    expect(mail.take()).toEqual([
      "gil@example.com: Club Matchplay, Semi-finals: you play Hal",
      "hal@example.com: Club Matchplay, Semi-finals: you play Gil",
      "fay@example.com: Club Matchplay: you have a bye into round 2",
    ]);
    let ms = await matchesForComp(handle.db, c.id);
    const semi = at(ms, 1, 1);
    await reportAndTell(ctx(), semi, b!, cc!.id, "2&1");
    expect(mail.take()).toEqual(["hal@example.com: Result reported: Club Matchplay"]);
    ms = await matchesForComp(handle.db, c.id);
    await disputeAndTell(ctx(), at(ms, 1, 1), cc!, "I won 2&1, not Gil");
    expect(mail.take()).toEqual(["pro@club.test: Result disputed: Club Matchplay"]);
    ms = await matchesForComp(handle.db, c.id);
    await clubResultAndTell(ctx(), at(ms, 1, 1), cc!.id, "2&1");
    expect(mail.take()).toEqual([
      "gil@example.com: Result: Club Matchplay",
      "hal@example.com: Result: Club Matchplay",
      "fay@example.com: Club Matchplay, Final: you play Hal",
      "hal@example.com: Club Matchplay, Final: you play Fay",
    ]);
    // The final: reported and confirmed, and the club hears who won.
    ms = await matchesForComp(handle.db, c.id);
    const final = await reportAndTell(ctx(), at(ms, 2, 0), a!, a!.id, "1 up");
    mail.take();
    await confirmAndTell(ctx(), final, cc!);
    expect(mail.take()).toEqual([
      "fay@example.com: Result: Club Matchplay",
      "hal@example.com: Result: Club Matchplay",
      "pro@club.test: Club Matchplay: Fay won",
    ]);
  });

  it("reminds players before the play-by date and tells the club when it's overdue, once each", async () => {
    const c = await comp();
    await add(c, "Ivy");
    await add(c, "Jo");
    const drawn = await makeDraw(handle.db, c, (x) => x, now);
    await setRoundDates(handle.db, drawn, ["2026-11-08"], now);
    await publishDrawAndTell(ctx(), (await compById(handle.db, c.id))!, actor);
    mail.take();
    const early = await tidyMatchplay(ctx(perthToUtc("2026-11-04", "09:00")));
    expect(early.reminders).toBe(0);
    const close = await tidyMatchplay(ctx(perthToUtc("2026-11-06", "09:00")));
    expect(close.reminders).toBe(1);
    expect(mail.take()).toEqual([
      "ivy@example.com: Reminder: play Jo by Sun 8 Nov",
      "jo@example.com: Reminder: play Ivy by Sun 8 Nov",
    ]);
    const late = await tidyMatchplay(ctx(perthToUtc("2026-11-09", "09:00")));
    expect(late).toMatchObject({ reminders: 0, overdue: 1 });
    expect(mail.take()).toEqual(["pro@club.test: Overdue: Ivy v Jo"]);
    expect((await tidyMatchplay(ctx(perthToUtc("2026-11-10", "09:00")))).overdue).toBe(0);
  });

  it("lets a reported result stand after 48 hours", async () => {
    const c = await comp();
    const [k, l] = [await add(c, "Kim"), await add(c, "Lou")];
    await makeDraw(handle.db, c, (x) => x, now);
    await publishDrawAndTell(ctx(), (await compById(handle.db, c.id))!, actor);
    const ms = await matchesForComp(handle.db, c.id);
    await reportAndTell(ctx(), at(ms, 1, 0), k!, k!.id, "5&4");
    mail.take();
    const later = await tidyMatchplay(ctx(new Date(now.getTime() + 49 * 3_600_000)));
    expect(later.decided).toBe(1);
    expect(await compById(handle.db, c.id)).toMatchObject({
      status: "finished",
      winnerEntryId: k!.id,
    });
    expect(l).toBeTruthy();
  });
});
