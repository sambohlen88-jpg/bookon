import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import {
  BlockProblem,
  addCoachBlock,
  coachByCalendarToken,
  coachCalendar,
  coachCalendarToken,
  coachesWithBusyCalendars,
  removeCoachBlock,
  resetCoachCalendarToken,
  saveBusyCalendarError,
  saveBusyCalendarRead,
  setBusyCalendarUrl,
} from "./coach-calendar";
import { approveCoach, coachById, saveCoachDraft, submitCoach } from "./coaches";
import { LessonTimeTaken, createLessonBooking, takenLessonTimes } from "./lessons";
import { seed } from "./seed";

const now = perthToUtc("2026-10-19", "10:00");
const admin = { email: "admin@bookon.test", role: "admin" as const };
const at = (date: string, time: string) => perthToUtc(date, time);

let handle: DbHandle;
let coachId: string;
beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const draft = await saveCoachDraft(
    handle.db,
    "cal@coach.test",
    {
      name: "Cal Coach",
      headline: "All-round",
      bio: "Lessons.",
      specialities: ["all-round"],
      rates: [{ name: "Lesson", minutes: 60, priceCents: 9000, people: "1" }],
      hours: [{ day: 6, from: "07:00", to: "12:00" }],
      away: [],
      places: [{ name: "Range", suburb: "Como" }],
      suburb: "Como",
      area: "south",
      contact: {},
    },
    now,
    { by: "Cal Coach" },
  );
  await submitCoach(handle.db, draft.id, now);
  await approveCoach(handle.db, (await coachById(handle.db, draft.id))!, admin, null, now);
  coachId = draft.id;
});
afterAll(async () => {
  await handle.close();
});

describe("the private calendar link", () => {
  it("is made once, finds the coach, and can be replaced", async () => {
    const db = handle.db;
    const token = await coachCalendarToken(db, (await coachById(db, coachId))!, now);
    expect(await coachCalendarToken(db, (await coachById(db, coachId))!, now)).toBe(token);
    expect((await coachByCalendarToken(db, token))?.id).toBe(coachId);
    const fresh = await resetCoachCalendarToken(db, coachId, now);
    expect(fresh).not.toBe(token);
    expect(await coachByCalendarToken(db, token)).toBeNull();
    expect((await coachByCalendarToken(db, fresh))?.id).toBe(coachId);
  });
});

describe("blocked times", () => {
  it("stop bookings, and only the coach's own can be removed", async () => {
    const db = handle.db;
    const block = await addCoachBlock(
      db,
      coachId,
      { start: at("2026-10-24", "09:00"), end: at("2026-10-24", "10:30"), note: "Physio" },
      now,
    );
    expect(await takenLessonTimes(db, coachId, now)).toEqual([
      { start: at("2026-10-24", "09:00"), end: at("2026-10-24", "10:30") },
    ]);
    await expect(
      createLessonBooking(
        db,
        {
          coachId,
          rate: { name: "Lesson", minutes: 60, priceCents: 9000, people: "1" },
          startTime: at("2026-10-24", "10:00"),
          place: "Range, Como",
          golferName: "A",
          golferEmail: "a@example.com",
          golferPhone: "+61491570110",
          feeCents: 250,
          provider: "practice",
        },
        now,
      ),
    ).rejects.toBeInstanceOf(LessonTimeTaken);
    expect(await removeCoachBlock(db, "00000000-0000-0000-0000-000000000000", block.id)).toBe(
      false,
    );
    expect(await removeCoachBlock(db, coachId, block.id)).toBe(true);
    expect(await takenLessonTimes(db, coachId, now)).toEqual([]);
  });

  it("must end after they start, be ahead, and be a month at most", async () => {
    const db = handle.db;
    const start = at("2026-10-24", "09:00");
    await expect(addCoachBlock(db, coachId, { start, end: start }, now)).rejects.toBeInstanceOf(
      BlockProblem,
    );
    await expect(
      addCoachBlock(
        db,
        coachId,
        { start: at("2026-10-01", "09:00"), end: at("2026-10-01", "10:00") },
        now,
      ),
    ).rejects.toThrow("already passed");
    await expect(
      addCoachBlock(db, coachId, { start, end: at("2026-12-24", "09:00") }, now),
    ).rejects.toThrow("at most a month");
  });
});

describe("busy times from the coach's calendar", () => {
  it("are replaced on each read, kept when a read fails, and cleared with the link", async () => {
    const db = handle.db;
    await setBusyCalendarUrl(db, coachId, "https://calendar.google.com/x.ics", now);
    expect((await coachesWithBusyCalendars(db)).map((c) => c.id)).toEqual([coachId]);
    await saveBusyCalendarRead(
      db,
      coachId,
      [
        { start: at("2026-10-24", "07:00"), end: at("2026-10-24", "08:00") },
        { start: at("2026-10-31", "07:00"), end: at("2026-10-31", "08:00") },
      ],
      now,
    );
    await saveBusyCalendarRead(
      db,
      coachId,
      [{ start: at("2026-10-24", "11:00"), end: at("2026-10-24", "12:00") }],
      now,
    );
    expect((await takenLessonTimes(db, coachId, now)).map((t) => t.start)).toEqual([
      at("2026-10-24", "11:00"),
    ]);

    await saveBusyCalendarError(db, coachId, "Your calendar didn't answer.", now);
    expect((await coachById(db, coachId))?.busyCalendarError).toBe("Your calendar didn't answer.");
    expect(await takenLessonTimes(db, coachId, now)).toHaveLength(1);

    await setBusyCalendarUrl(db, coachId, null, now);
    expect(await takenLessonTimes(db, coachId, now)).toEqual([]);
    expect(await coachesWithBusyCalendars(db)).toEqual([]);
  });
});

describe("coachCalendar", () => {
  it("lists blocks and busy times in the range", async () => {
    const db = handle.db;
    await addCoachBlock(
      db,
      coachId,
      { start: at("2026-10-26", "09:00"), end: at("2026-10-26", "10:00") },
      now,
    );
    await addCoachBlock(
      db,
      coachId,
      { start: at("2026-11-26", "09:00"), end: at("2026-11-26", "10:00") },
      now,
    );
    const october = await coachCalendar(
      db,
      coachId,
      at("2026-10-01", "00:00"),
      at("2026-11-01", "00:00"),
    );
    expect(october.busy.map((b) => b.startTime)).toEqual([at("2026-10-26", "09:00")]);
  });
});
