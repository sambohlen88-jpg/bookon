import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { perthToUtc, type CoachRate } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import {
  approveCoach,
  coachById,
  liveCoachBySlug,
  saveCoachDraft,
  seedSampleCoaches,
  submitCoach,
} from "./coaches";
import {
  LessonTimeTaken,
  acceptLesson,
  acceptLessonPaymentTerms,
  acceptedLessonPaymentTerms,
  cancelLesson,
  createLessonBooking,
  declineLesson,
  lapseLesson,
  lessonByToken,
  lessonPaymentSettings,
  lessonTotals,
  lessonsForCoach,
  lessonsForGolfer,
  markLessonAbandoned,
  markLessonRequested,
  overdueLessonRequests,
  setCoachPaymentAccount,
  setCoachPaymentsReady,
  setCoachTakesBookings,
  setLessonPaymentSettings,
  staleLessonCheckouts,
  takenLessonTimes,
} from "./lessons";
import { coaches } from "./schema";
import { seed } from "./seed";

// Sunday 18 October 2026, 10 am Perth.
const now = perthToUtc("2026-10-18", "10:00");
const admin = { email: "admin@bookon.test", role: "admin" as const };
const rate: CoachRate = { name: "Private lesson", minutes: 60, priceCents: 9000, people: "1" };
const saturday9 = perthToUtc("2026-10-24", "09:00");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

let handle: DbHandle;
let coachId: string;
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
      rates: [rate],
      hours: [{ day: 6, from: "07:00", to: "12:00" }],
      away: [],
      places: [{ name: "Range", suburb: "Como" }],
      suburb: "Como",
      area: "south",
      contact: {},
    },
    now,
    { by: "Jo Coach" },
  );
  await submitCoach(handle.db, draft.id, now);
  await approveCoach(handle.db, (await coachById(handle.db, draft.id))!, admin, null, now);
  coachId = draft.id;
});
afterAll(async () => {
  await handle.close();
});

function book(startTime: Date, email = "golfer@example.com") {
  return createLessonBooking(
    handle.db,
    {
      coachId,
      rate,
      startTime,
      place: "Range, Como",
      golferName: "Alex Golfer",
      golferEmail: email,
      golferPhone: "+61491570110",
      feeCents: 250,
      provider: "practice",
    },
    now,
  );
}

describe("coach payment accounts", () => {
  it("only take bookings once Stripe says the account is ready, and stop if it isn't", async () => {
    const db = handle.db;
    await setCoachPaymentAccount(db, coachId, "acct_123", now);
    expect(await setCoachTakesBookings(db, coachId, true, now)).toBe(false);
    await setCoachPaymentsReady(db, "acct_123", true, now);
    expect(await setCoachTakesBookings(db, coachId, true, now)).toBe(true);
    expect((await liveCoachBySlug(db, "jo-coach"))?.takesBookings).toBe(true);

    await setCoachPaymentsReady(db, "acct_123", false, now);
    expect((await liveCoachBySlug(db, "jo-coach"))?.takesBookings).toBe(false);
    await setCoachPaymentsReady(db, "acct_123", true, now);
    await setCoachTakesBookings(db, coachId, true, now);
  });

  it("record the payment terms with the coach's other consents", async () => {
    const db = handle.db;
    await acceptLessonPaymentTerms(db, coachId, "Jo Coach", now);
    const coach = (await coachById(db, coachId))!;
    expect(acceptedLessonPaymentTerms(coach.consents)).toBe(true);
    // The listing consent is kept.
    expect(coach.consents.public).toBeTruthy();
  });
});

describe("lesson bookings", () => {
  it("hold the time during checkout, so nobody else can take it", async () => {
    const booking = await book(saturday9);
    expect(booking).toMatchObject({ status: "checkout", lessonCents: 9000, feeCents: 250 });
    expect(booking.endTime).toEqual(perthToUtc("2026-10-24", "10:00"));
    expect((await lessonByToken(handle.db, booking.manageToken))?.id).toBe(booking.id);
    expect(await lessonByToken(handle.db, "x".repeat(32))).toBeNull();

    // 9:30 overlaps; 10:00 doesn't.
    await expect(book(perthToUtc("2026-10-24", "09:30"))).rejects.toBeInstanceOf(LessonTimeTaken);
    const next = await book(perthToUtc("2026-10-24", "10:00"));
    expect(next.status).toBe("checkout");
    await markLessonAbandoned(handle.db, next.id);
  });

  it("free the time if checkout isn't finished in 30 minutes", async () => {
    const db = handle.db;
    expect(await staleLessonCheckouts(db, minutes(29))).toHaveLength(0);
    const stale = await staleLessonCheckouts(db, minutes(31));
    expect(stale).toHaveLength(1);
    expect(await takenLessonTimes(db, coachId, minutes(31))).toHaveLength(0);
    await markLessonAbandoned(db, stale[0]!.id);
  });

  it("go to the coach once the card is held, only once, with a time to answer by", async () => {
    const db = handle.db;
    const booking = await book(perthToUtc("2026-10-24", "11:00"));
    const requested = await markLessonRequested(db, booking.id, "pi_1", now);
    expect(requested).toMatchObject({ status: "requested", paymentId: "pi_1" });
    expect(requested!.respondBy).toEqual(new Date(now.getTime() + 48 * 60 * 60 * 1000));
    // A second webhook for the same payment does nothing.
    expect(await markLessonRequested(db, booking.id, "pi_1", now)).toBeNull();
    expect((await lessonsForCoach(db, coachId, now)).requests).toHaveLength(1);

    expect(await acceptLesson(db, booking.id, now)).toMatchObject({ status: "confirmed" });
    expect(await declineLesson(db, booking.id, null, now)).toBeNull();
    const lists = await lessonsForCoach(db, coachId, now);
    expect(lists.requests).toHaveLength(0);
    expect(lists.upcoming.map((b) => b.id)).toEqual([booking.id]);
  });

  it("lapse when the coach doesn't answer in time", async () => {
    const db = handle.db;
    const booking = await book(perthToUtc("2026-10-31", "08:00"), "other@example.com");
    await markLessonRequested(db, booking.id, "pi_2", now);
    expect(await overdueLessonRequests(db, minutes(47 * 60))).toHaveLength(0);
    const overdue = await overdueLessonRequests(db, minutes(48 * 60));
    expect(overdue.map((b) => b.id)).toEqual([booking.id]);
    expect(await lapseLesson(db, booking.id, minutes(48 * 60))).toMatchObject({ status: "lapsed" });
    // The time is free again.
    expect(
      (await takenLessonTimes(db, coachId, now)).some(
        (t) => t.start.getTime() === booking.startTime.getTime(),
      ),
    ).toBe(false);
  });

  it("can be cancelled by the golfer while waiting or booked, but by the coach only once booked", async () => {
    const db = handle.db;
    const booking = await book(perthToUtc("2026-10-31", "09:00"));
    await markLessonRequested(db, booking.id, "pi_3", now);
    expect(await cancelLesson(db, booking.id, { by: "coach", refundCents: 9250 }, now)).toBeNull();
    expect(await cancelLesson(db, booking.id, { by: "golfer", refundCents: 0 }, now)).toMatchObject(
      { status: "cancelled", cancelledBy: "golfer" },
    );

    const second = await book(perthToUtc("2026-10-31", "10:00"));
    await markLessonRequested(db, second.id, "pi_4", now);
    await acceptLesson(db, second.id, now);
    expect(
      await cancelLesson(db, second.id, { by: "coach", refundCents: 9250, note: "Sick" }, now),
    ).toMatchObject({
      status: "cancelled",
      cancelledBy: "coach",
      refundCents: 9250,
      coachNote: "Sick",
    });
  });

  it("show a golfer their lessons, but not unpaid checkouts", async () => {
    const mine = await lessonsForGolfer(handle.db, "Golfer@Example.com");
    expect(mine.map((b) => b.status).sort()).toEqual(["cancelled", "cancelled", "confirmed"]);
  });

  it("add up for Reports: accepted lessons, and fees kept after refunds", async () => {
    const totals = await lessonTotals(handle.db, minutes(-60), minutes(60));
    // Requested: 11 am (confirmed), 8 am Sat 31 (lapsed), 9 am (cancelled), 10 am (cancelled by coach).
    expect(totals).toEqual({ requested: 4, booked: 2, coachCents: 9000, feeCents: 250 });
  });
});

describe("lesson payment settings", () => {
  it("are on with a $2.50 fee until changed", async () => {
    const db = handle.db;
    expect(await lessonPaymentSettings(db)).toEqual({ enabled: true, feeCents: 250 });
    await setLessonPaymentSettings(db, { enabled: false, feeCents: 350 }, admin, now);
    expect(await lessonPaymentSettings(db)).toEqual({ enabled: false, feeCents: 350 });
  });
});

describe("sample coaches", () => {
  it("take practice bookings on local databases", async () => {
    const db = handle.db;
    await seedSampleCoaches(db, now);
    const rows = await db.select().from(coaches);
    const samples = rows.filter((c) => c.sample);
    expect(samples).toHaveLength(3);
    for (const c of samples) {
      expect(c.paymentAccountId).toBe(`practice_acct_${c.slug}`);
      expect(c.takesBookings && c.paymentsReady).toBe(true);
    }
    // Real coaches are left alone.
    expect(rows.find((c) => c.id === coachId)?.paymentAccountId).toBe("acct_123");
  });
});
