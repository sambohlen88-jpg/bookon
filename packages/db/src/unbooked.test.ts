import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TeeTime } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import {
  finishFetchRun,
  findCourseBySlug,
  pruneOldSnapshots,
  saveDayAvailability,
  startFetchRun,
} from "./queries";
import { appSettings, unbookedSlots } from "./schema";
import { seed } from "./seed";
import { dayPart, unbookedReport } from "./unbooked";

let handle: DbHandle;
let collier: string;
let sims: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
  sims = (await findCourseBySlug(handle.db, "outtabounds-simulators"))!.id;
});
afterAll(async () => {
  await handle.close();
});
beforeEach(async () => {
  await handle.db.delete(unbookedSlots);
});

/** A Perth time on Monday 19 October 2026. */
const at = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+08:00`);

function slot(courseId: string, hhmm: string, overrides: Partial<TeeTime> = {}): TeeTime {
  return {
    courseId,
    startTime: at(hhmm),
    holes: 18,
    layout: null,
    spotsAvailable: 3,
    minPlayers: 1,
    priceCents: 4000,
    sourceUrl: "https://example.com",
    bookingUrl: null,
    ...overrides,
  };
}

const day = "2026-10-19";
const recorded = async () =>
  (await handle.db.select().from(unbookedSlots)).map((s) => s.startTime.toISOString()).sort();

describe("recording unbooked tee times", () => {
  it("keeps tee times still free within the hour before they started", async () => {
    const db = handle.db;
    // 7:20 check: 7:50 is free; 8:40 too, but that's 80 minutes ahead.
    await saveDayAvailability(
      db,
      collier,
      day,
      [slot(collier, "07:50"), slot(collier, "08:40"), slot(collier, "09:00")],
      at("07:20"),
    );
    // 8:00 check: 7:50 has started, last seen free 30 minutes before.
    await saveDayAvailability(
      db,
      collier,
      day,
      [slot(collier, "08:40"), slot(collier, "09:00"), slot(collier, "09:40")],
      at("08:00"),
    );
    expect(await recorded()).toEqual([at("07:50").toISOString()]);
    // 9:10 check: 8:40 and 9:00 (seen free at 8:00, an hour before) went unbooked.
    await saveDayAvailability(db, collier, day, [], at("09:10"));
    expect(await recorded()).toEqual(["07:50", "08:40", "09:00"].map((t) => at(t).toISOString()));
  });

  it("doesn't count a tee time booked before it started", async () => {
    const db = handle.db;
    await saveDayAvailability(db, collier, day, [slot(collier, "08:00")], at("07:20"));
    // Gone by the 7:40 check: someone booked it.
    await saveDayAvailability(db, collier, day, [], at("07:40"));
    await saveDayAvailability(db, collier, day, [], at("08:10"));
    expect(await recorded()).toEqual([]);
  });

  it("doesn't guess when the last check was too long before", async () => {
    const db = handle.db;
    await saveDayAvailability(db, collier, day, [slot(collier, "09:30")], at("08:00"));
    // The worker was off until the next day; the old day is cleared.
    await pruneOldSnapshots(db, "2026-10-20", new Date("2026-10-20T06:00:00+08:00"));
    expect(await recorded()).toEqual([]);
  });

  it("keeps the last day's unbooked times when old days are cleared", async () => {
    const db = handle.db;
    await saveDayAvailability(db, collier, day, [slot(collier, "17:30")], at("17:00"));
    await pruneOldSnapshots(db, "2026-10-20", new Date("2026-10-20T06:00:00+08:00"));
    expect(await recorded()).toEqual([at("17:30").toISOString()]);
  });

  it("leaves out simulators and ranges", async () => {
    const db = handle.db;
    await saveDayAvailability(
      db,
      sims,
      day,
      [slot(sims, "09:00", { holes: 0, bay: "s1", durations: [60] })],
      at("08:30"),
    );
    await saveDayAvailability(db, sims, day, [], at("09:10"));
    expect(await recorded()).toEqual([]);
  });
});

describe("unbookedReport", () => {
  it("adds up tee times, spots and green fees, by day and time of day, with how much was checked", async () => {
    const db = handle.db;
    await db
      .insert(appSettings)
      .values({ key: "unbooked_since", value: at("00:00").toISOString() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: at("00:00").toISOString() } });
    await db.insert(unbookedSlots).values([
      {
        courseId: collier,
        playDate: day,
        startTime: at("06:30"),
        holes: 18,
        spotsLeft: 4,
        priceCents: 4000,
        lastSeenAt: at("06:00"),
      },
      {
        courseId: collier,
        playDate: day,
        startTime: at("16:30"),
        holes: 9,
        spotsLeft: 2,
        priceCents: null,
        lastSeenAt: at("16:00"),
      },
    ]);
    // Checks every 30 minutes from 5:30 am to 12:30 pm, then the worker stopped.
    for (let m = 5 * 60 + 30; m <= 12 * 60 + 30; m += 30) {
      const finished = new Date(at("00:00").getTime() + m * 60000);
      const run = await startFetchRun(db, collier, day, day, finished);
      await finishFetchRun(db, run, { status: "ok", requestCount: 1, teeTimeCount: 1 }, finished);
    }
    const report = await unbookedReport(db, day, day, at("23:00"));
    const row = report.rows.find((r) => r.slug === "collier-park")!;
    expect(row).toMatchObject({
      unbooked: 2,
      spots: 6,
      valueCents: 16000,
      priced: 1,
      byWeekday: [2, 0, 0, 0, 0, 0, 0],
      byPart: { early: 1, morning: 0, midday: 0, afternoon: 0, twilight: 1 },
    });
    // Checked 6 am to 1:30 pm of the 6 am to 6:30 pm day: 16 of 26 half hours.
    expect(row.coverage).toBeCloseTo(16 / 26, 5);
    expect(report.totals.unbooked).toBe(2);
    // Simulators aren't listed.
    expect(report.rows.some((r) => r.slug === "outtabounds-simulators")).toBe(false);
  });

  it("sorts times into parts of the day, Perth time", () => {
    expect(dayPart(at("06:59"))).toBe("early");
    expect(dayPart(at("07:00"))).toBe("morning");
    expect(dayPart(at("12:59"))).toBe("midday");
    expect(dayPart(at("15:00"))).toBe("afternoon");
    expect(dayPart(at("19:10"))).toBe("twilight");
  });
});
