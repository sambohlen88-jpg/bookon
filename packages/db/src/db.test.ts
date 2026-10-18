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
import { seed, seedIfEmpty } from "./seed";

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
  it("creates the courses, with Wembley switched off", async () => {
    const enabled = await listEnabledCourses(handle.db);
    // 26 golf courses and 5 simulator or range venues.
    expect(enabled).toHaveLength(31);
    expect(enabled.map((c) => c.slug)).toEqual(
      expect.arrayContaining(["collier-park", "hamersley", "the-cut"]),
    );
    expect(await findCourseBySlug(handle.db, "wembley")).toMatchObject({
      platform: "miclub",
      enabled: false,
    });
    expect(await findCourseBySlug(handle.db, "marangaroo")).toMatchObject({
      platform: "miclub",
      enabled: true,
      bookingWindowDays: 11,
      platformConfig: { baseUrl: "https://marangaroo.miclub.com.au", bookingResourceId: "3000000" },
    });
    expect(await findCourseBySlug(handle.db, "albatross-lounge")).toMatchObject({
      platform: "ygb",
      kind: "simulator",
      holes: 0,
      platformConfig: { venue: "albatross-lounge", group: "bays", bays: ["1", "2"] },
    });
    expect(await findCourseBySlug(handle.db, "collier-park")).toMatchObject({ kind: "course" });
    expect(await findCourseBySlug(handle.db, "joondalup-resort")).toMatchObject({
      platformConfig: expect.objectContaining({ bookingResourceId: "3900000" }),
    });
  });

  it("only seeds a database with no golf courses", async () => {
    const fresh = createDb("pglite:memory");
    await fresh.migrate();
    // The migrations add the sims and ranges, but not the golf courses.
    expect(await listEnabledCourses(fresh.db)).toHaveLength(5);
    expect(await seedIfEmpty(fresh.db)).toBe(true);
    expect(await listEnabledCourses(fresh.db)).toHaveLength(31);
    expect(await seedIfEmpty(fresh.db)).toBe(false);
    await fresh.close();
  });

  it("can run twice without duplicating", async () => {
    await seed(handle.db);
    expect(await listEnabledCourses(handle.db)).toHaveLength(31);
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
