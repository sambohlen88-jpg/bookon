import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, findCourseBySlug, schema, seed, snapshotsFor, type DbHandle } from "@bookon/db";
import type { HttpClient } from "@bookon/core";
import { pollAll, pollCourse, pollRange } from "./poll";

const hamersley = readFileSync(
  new URL("../../../packages/adapters/fixtures/quick18/hamersley-2025-10-18.html", import.meta.url),
  "utf8",
);

/** Serves the Hamersley fixture for 18 October 2025 and fails everything else. */
class FixtureHttp implements HttpClient {
  requestCount = 0;
  async getText(url: string): Promise<string> {
    this.requestCount++;
    if (url.includes("hamersley.quick18.com") && url.includes("teedate=20251018")) return hamersley;
    throw new Error(`HTTP 503 for ${url}`);
  }
}

// 7:00 am Perth on Saturday 18 October 2025.
const now = () => new Date("2025-10-17T23:00:00Z");

let handle: DbHandle;

beforeEach(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});

afterEach(async () => {
  await handle.close();
});

describe("pollRange", () => {
  it("runs from today in Perth to the end of the booking window by default", async () => {
    const course = (await findCourseBySlug(handle.db, "wembley"))!;
    expect(pollRange(course, now())).toEqual({ from: "2025-10-18", to: "2025-10-27" });
    expect(pollRange(course, now(), 2)).toEqual({ from: "2025-10-18", to: "2025-10-19" });
    // An explicit day count can look past the window, to find where a club's window really ends.
    expect(pollRange(course, now(), 12)).toEqual({ from: "2025-10-18", to: "2025-10-29" });
  });
});

describe("pollCourse", () => {
  it("stores tee times read from the club's page and logs the run", async () => {
    const course = (await findCourseBySlug(handle.db, "hamersley"))!;
    const http = new FixtureHttp();
    const result = await pollCourse(handle.db, course, http, { now, days: 1 });

    expect(result).toEqual({ course: "hamersley", status: "ok", teeTimes: 17 });
    const rows = await snapshotsFor(handle.db, [course.id], "2025-10-18");
    expect(rows).toHaveLength(17);
    expect(rows[0]).toMatchObject({ holes: 9, layout: "Back 9 Morning", priceCents: 3300 });

    const [run] = await handle.db.select().from(schema.fetchRuns);
    expect(run).toMatchObject({ status: "ok", requestCount: 1, teeTimeCount: 17 });
  });

  it("records a failure for every date in range without throwing", async () => {
    const course = (await findCourseBySlug(handle.db, "hamersley"))!;
    const result = await pollCourse(handle.db, course, new FixtureHttp(), { now, days: 3 });

    expect(result.status).toBe("error");
    expect(result.error).toContain("HTTP 503");
    const checks = await handle.db.select().from(schema.availabilityChecks);
    expect(checks.map((c) => [c.playDate, c.status])).toEqual([
      ["2025-10-18", "error"],
      ["2025-10-19", "error"],
      ["2025-10-20", "error"],
    ]);
  });

  it("skips courses with no adapter, such as Chronogolf", async () => {
    const course = (await findCourseBySlug(handle.db, "marangaroo"))!;
    const http = new FixtureHttp();
    const result = await pollCourse(
      handle.db,
      { ...course, platform: "chronogolf", enabled: true },
      http,
      { now },
    );
    expect(result.status).toBe("skipped");
    expect(http.requestCount).toBe(0);
  });
});

describe("pollAll", () => {
  it("counts each course's own requests when polling in parallel", async () => {
    const hamersleyCourse = (await findCourseBySlug(handle.db, "hamersley"))!;
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    await pollAll(handle.db, [collier, hamersleyCourse], new FixtureHttp(), {
      now,
      days: 1,
      pausedPlatforms: [],
    });
    const runs = await handle.db.select().from(schema.fetchRuns);
    expect(runs.map((r) => r.requestCount).sort()).toEqual([1, 1]);
  });

  it("keeps going when one course fails", async () => {
    const hamersleyCourse = (await findCourseBySlug(handle.db, "hamersley"))!;
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    const results = await pollAll(handle.db, [collier, hamersleyCourse], new FixtureHttp(), {
      now,
      days: 1,
      pausedPlatforms: [],
    });
    expect(results.map((r) => [r.course, r.status])).toEqual([
      ["collier-park", "error"],
      ["hamersley", "ok"],
    ]);
  });

  it("doesn't read MiClub while it's paused (27 October 2026)", async () => {
    const hamersleyCourse = (await findCourseBySlug(handle.db, "hamersley"))!;
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    const http = new FixtureHttp();
    const results = await pollAll(handle.db, [collier, hamersleyCourse], http, { now, days: 1 });
    expect(results.map((r) => [r.course, r.status])).toEqual([
      ["collier-park", "skipped"],
      ["hamersley", "ok"],
    ]);
    expect(http.requestCount).toBe(1);
  });
});
