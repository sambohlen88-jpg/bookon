import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TeeTime } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import {
  findCourseBySlug,
  finishFetchRun,
  listEnabledCourses,
  pruneOldSnapshots,
  recordDayFailures,
  saveDayAvailability,
  snapshotsFor,
  startFetchRun,
} from "./queries";
import { availabilityChecks, fetchRuns } from "./schema";
import { seed } from "./seed";

let handle: DbHandle;

beforeEach(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});

afterEach(async () => {
  await handle.close();
});

function teeTime(courseId: string, iso: string, overrides: Partial<TeeTime> = {}): TeeTime {
  return {
    courseId,
    startTime: new Date(iso),
    holes: 18,
    layout: null,
    spotsAvailable: 4,
    minPlayers: 1,
    priceCents: 4900,
    sourceUrl: "https://example.com/source",
    bookingUrl: null,
    ...overrides,
  };
}

describe("seed", () => {
  it("creates the five launch courses, with Wembley and the Chronogolf courses switched off", async () => {
    const enabled = await listEnabledCourses(handle.db);
    expect(enabled.map((c) => c.slug)).toEqual(["collier-park", "hamersley"]);
    expect(await findCourseBySlug(handle.db, "wembley")).toMatchObject({
      platform: "miclub",
      enabled: false,
    });
    const marangaroo = await findCourseBySlug(handle.db, "marangaroo");
    expect(marangaroo).toMatchObject({
      platform: "chronogolf",
      enabled: false,
      bookingWindowDays: 11,
    });
    expect(await findCourseBySlug(handle.db, "the-cut")).toMatchObject({ enabled: false });
  });

  it("can run twice without duplicating", async () => {
    await seed(handle.db);
    expect(await listEnabledCourses(handle.db)).toHaveLength(2);
  });
});

describe("availability", () => {
  it("replaces a day's tee times on each successful check", async () => {
    const course = (await findCourseBySlug(handle.db, "collier-park"))!;
    const first = new Date("2026-10-17T01:00:00Z");
    await saveDayAvailability(
      handle.db,
      course.id,
      "2026-10-18",
      [teeTime(course.id, "2026-10-17T22:00:00Z"), teeTime(course.id, "2026-10-17T22:08:00Z")],
      first,
    );
    const second = new Date("2026-10-17T01:30:00Z");
    await saveDayAvailability(
      handle.db,
      course.id,
      "2026-10-18",
      [teeTime(course.id, "2026-10-17T23:00:00Z")],
      second,
    );

    const rows = await snapshotsFor(handle.db, [course.id], "2026-10-18");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fetchedAt.toISOString()).toBe(second.toISOString());

    const [check] = await handle.db.select().from(availabilityChecks);
    expect(check).toMatchObject({ status: "ok", teeTimeCount: 1, error: null });
  });

  it("keeps the last good time when a check fails", async () => {
    const course = (await findCourseBySlug(handle.db, "hamersley"))!;
    const good = new Date("2026-10-17T01:00:00Z");
    await saveDayAvailability(
      handle.db,
      course.id,
      "2026-10-18",
      [teeTime(course.id, "2026-10-17T22:00:00Z")],
      good,
    );
    const bad = new Date("2026-10-17T02:00:00Z");
    await recordDayFailures(handle.db, course.id, ["2026-10-18", "2026-10-19"], "HTTP 503", bad);

    const checks = await handle.db
      .select()
      .from(availabilityChecks)
      .orderBy(availabilityChecks.playDate);
    expect(
      checks.map((c) => [c.playDate, c.status, c.lastSuccessAt?.toISOString() ?? null, c.error]),
    ).toEqual([
      ["2026-10-18", "error", good.toISOString(), "HTTP 503"],
      ["2026-10-19", "error", null, "HTTP 503"],
    ]);
  });

  it("prunes past days", async () => {
    const course = (await findCourseBySlug(handle.db, "hamersley"))!;
    const at = new Date("2026-10-17T01:00:00Z");
    await saveDayAvailability(
      handle.db,
      course.id,
      "2026-10-16",
      [teeTime(course.id, "2026-10-15T22:00:00Z")],
      at,
    );
    await saveDayAvailability(
      handle.db,
      course.id,
      "2026-10-17",
      [teeTime(course.id, "2026-10-16T22:00:00Z")],
      at,
    );
    await pruneOldSnapshots(handle.db, "2026-10-17");
    expect(await snapshotsFor(handle.db, [course.id], "2026-10-16")).toHaveLength(0);
    expect(await snapshotsFor(handle.db, [course.id], "2026-10-17")).toHaveLength(1);
  });
});

describe("fetch runs", () => {
  it("records a run from start to finish", async () => {
    const course = (await findCourseBySlug(handle.db, "wembley"))!;
    const id = await startFetchRun(
      handle.db,
      course.id,
      "2026-10-17",
      "2026-10-26",
      new Date("2026-10-17T01:00:00Z"),
    );
    await finishFetchRun(
      handle.db,
      id,
      { status: "error", requestCount: 2, teeTimeCount: 0, error: "robots.txt disallows" },
      new Date("2026-10-17T01:00:05Z"),
    );
    const [run] = await handle.db.select().from(fetchRuns);
    expect(run).toMatchObject({ status: "error", requestCount: 2, error: "robots.txt disallows" });
  });
});
