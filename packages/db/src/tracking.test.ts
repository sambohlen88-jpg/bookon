import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug } from "./queries";
import { clickEvents, dailyImpressions, searches } from "./schema";
import type { SearchParams } from "./search";
import { seed } from "./seed";
import {
  bookingHostsFor,
  courseActivity,
  courseIdsForSlugs,
  logClick,
  logSearch,
  type SearchLog,
} from "./tracking";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

let handle: DbHandle;
let collier: string;
let hamersley: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
  hamersley = (await findCourseBySlug(handle.db, "hamersley"))!.id;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(searches);
  await handle.db.delete(dailyImpressions);
  await handle.db.delete(clickEvents);
});

const params: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: null,
  courseSlugs: null,
};

function search(overrides: Partial<SearchLog> = {}): SearchLog {
  return {
    sessionId: "session-a",
    params,
    courseIds: [],
    resultCount: 12,
    shownCourseIds: [collier, hamersley],
    now,
    ...overrides,
  };
}

describe("logSearch", () => {
  it("records the search and one impression per course shown", async () => {
    expect(await logSearch(handle.db, search())).toBe(true);
    const [row] = await handle.db.select().from(searches);
    expect(row).toMatchObject({ players: 2, holes: null, resultCount: 12, timeFrom: "06:00:00" });
    const impressions = await handle.db.select().from(dailyImpressions);
    expect(impressions).toHaveLength(2);
    expect(impressions.every((i) => i.day === "2026-10-17" && i.impressions === 1)).toBe(true);
  });

  it("counts a refresh within a minute once", async () => {
    await logSearch(handle.db, search());
    expect(await logSearch(handle.db, search({ now: later(30_000) }))).toBe(false);
    expect(await handle.db.select().from(searches)).toHaveLength(1);
    const [impression] = await handle.db.select().from(dailyImpressions);
    expect(impression!.impressions).toBe(1);
  });

  it("counts a different search, another visitor, or the same search later", async () => {
    await logSearch(handle.db, search());
    expect(
      await logSearch(handle.db, search({ params: { ...params, players: 3 }, now: later(1000) })),
    ).toBe(true);
    expect(await logSearch(handle.db, search({ sessionId: "session-b", now: later(2000) }))).toBe(
      true,
    );
    expect(await logSearch(handle.db, search({ now: later(120_000) }))).toBe(true);
    const impressions = await handle.db.select().from(dailyImpressions);
    expect(impressions.find((i) => i.courseId === collier)!.impressions).toBe(4);
  });
});

describe("logClick", () => {
  const slot = new Date("2026-10-17T22:08:00Z");

  it("records a click and ignores a repeat on the same slot within 10 minutes", async () => {
    const click = {
      sessionId: "session-a",
      courseId: collier,
      startTime: slot,
      source: "search" as const,
      now,
    };
    expect(await logClick(handle.db, click)).toBe(true);
    expect(await logClick(handle.db, { ...click, now: later(5 * 60_000) })).toBe(false);
    expect(await logClick(handle.db, { ...click, now: later(11 * 60_000) })).toBe(true);
    expect(
      await logClick(handle.db, {
        ...click,
        startTime: new Date("2026-10-17T22:16:00Z"),
        now: later(1000),
      }),
    ).toBe(true);
    expect(await handle.db.select().from(clickEvents)).toHaveLength(3);
  });
});

describe("bookingHostsFor", () => {
  it("allows the course's booking site only", async () => {
    expect(await bookingHostsFor(handle.db, collier)).toEqual(["bookings.collierparkgolf.com.au"]);
    expect(await bookingHostsFor(handle.db, hamersley)).toEqual(["hamersley.quick18.com"]);
    expect(await bookingHostsFor(handle.db, "00000000-0000-0000-0000-000000000000")).toEqual([]);
  });
});

describe("courseIdsForSlugs", () => {
  it("maps slugs to ids", async () => {
    expect(await courseIdsForSlugs(handle.db, ["collier-park"])).toEqual([collier]);
    expect(await courseIdsForSlugs(handle.db, [])).toEqual([]);
  });
});

describe("courseActivity", () => {
  it("adds up searches, impressions and clicks per course for a Perth date range", async () => {
    // All-course search, then one limited to Hamersley.
    await logSearch(handle.db, search());
    await logSearch(
      handle.db,
      search({ sessionId: "session-b", courseIds: [hamersley], shownCourseIds: [hamersley] }),
    );
    await logClick(handle.db, {
      sessionId: "session-a",
      courseId: collier,
      startTime: null,
      source: "search",
      now,
    });
    await logClick(handle.db, {
      sessionId: "session-b",
      courseId: collier,
      startTime: null,
      source: "alert",
      now,
    });
    // Outside the range: the next Perth day.
    await logClick(handle.db, {
      sessionId: "session-c",
      courseId: collier,
      startTime: null,
      source: "search",
      now: later(24 * 3600_000),
    });

    const rows = await courseActivity(handle.db, "2026-10-17", "2026-10-17");
    const byCourse = (id: string) => rows.find((r) => r.courseId === id)!;
    expect(byCourse(collier)).toMatchObject({
      searches: 1,
      impressions: 1,
      clicks: 2,
      golfers: 2,
      alertClicks: 1,
      shareClicks: 0,
    });
    expect(byCourse(hamersley)).toMatchObject({
      searches: 2,
      impressions: 2,
      clicks: 0,
      golfers: 0,
    });
  });
});
