import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import {
  approveCoach,
  coachById,
  createDb,
  saveCoachDraft,
  seed,
  setBusyCalendarUrl,
  submitCoach,
  takenLessonTimes,
  type DbHandle,
} from "@bookon/db";
import { refreshCoachCalendars } from "./calendars";

const now = perthToUtc("2026-10-19", "10:00");
const url = "https://calendar.google.com/calendar/ical/x/private-abc/basic.ics";
const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:physio",
  "DTSTART:20261024T010000Z",
  "DTEND:20261024T020000Z",
  "SUMMARY:Physio",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

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
      rates: [],
      hours: [],
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
  await approveCoach(
    handle.db,
    (await coachById(handle.db, draft.id))!,
    { email: "admin@bookon.test", role: "admin" },
    null,
    now,
  );
  coachId = draft.id;
  await setBusyCalendarUrl(handle.db, coachId, url, now);
});
afterAll(async () => {
  await handle.close();
});

describe("refreshCoachCalendars", () => {
  it("reads busy times, then waits before reading again", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(ics);
    }) as typeof fetch;
    const options = { userAgent: "BookOnBot/test", fetch: fetchImpl };
    expect(await refreshCoachCalendars(handle.db, { ...options, now })).toEqual({
      read: 1,
      fresh: 0,
      failed: 0,
    });
    expect(await takenLessonTimes(handle.db, coachId, now)).toEqual([
      { start: new Date("2026-10-24T01:00:00Z"), end: new Date("2026-10-24T02:00:00Z") },
    ]);
    const soon = new Date(now.getTime() + 10 * 60_000);
    expect(await refreshCoachCalendars(handle.db, { ...options, now: soon })).toMatchObject({
      fresh: 1,
    });
    expect(calls).toBe(1);
  });

  it("keeps the last busy times and tells the coach when a read fails", async () => {
    const later = new Date(now.getTime() + 60 * 60_000);
    const gone = (async () => new Response("gone", { status: 404 })) as typeof fetch;
    expect(
      await refreshCoachCalendars(handle.db, {
        userAgent: "BookOnBot/test",
        fetch: gone,
        now: later,
      }),
    ).toMatchObject({ failed: 1 });
    expect((await coachById(handle.db, coachId))?.busyCalendarError).toContain(
      "doesn't work any more",
    );
    expect(await takenLessonTimes(handle.db, coachId, now)).toHaveLength(1);
  });
});
