import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  accountReport,
  analyticsTotals,
  audienceReport,
  bookingFunnels,
  bucketKeys,
  liveVisitors,
  pageReport,
  purgeAnalytics,
  recordEvent,
  recordPageView,
  recordTimeOnPage,
  recordVital,
  returnCohorts,
  sourceReport,
  speedReport,
  teeTimeReport,
  visitorSeries,
  type PageViewInput,
} from "./analytics";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug } from "./queries";
import { analyticsEvents, clickEvents, pageViews, searches, webVitals } from "./schema";
import type { SearchParams } from "./search";
import { seed } from "./seed";
import { logClick, logSearch } from "./tracking";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const day = { from: "2026-10-17", to: "2026-10-17" };

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

let handle: DbHandle;

function view(visitorId: string, path: string, over: Partial<PageViewInput> = {}): PageViewInput {
  return {
    visitorId,
    path,
    referrer: null,
    ownHost: "bookon.au",
    utm: {},
    userAgent: IPHONE,
    width: 390,
    app: false,
    signedIn: false,
    country: "AU",
    region: "WA",
    city: "Perth",
    ...over,
  };
}

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});
afterAll(async () => {
  await handle.close();
});
beforeEach(async () => {
  for (const t of [pageViews, analyticsEvents, webVitals, searches, clickEvents])
    await handle.db.delete(t);
});

describe("recording", () => {
  it("groups page views into visits, with the source on the first page only", async () => {
    const db = handle.db;
    const first = await recordPageView(
      db,
      view("v1", "/", { referrer: "https://www.google.com.au/" }),
      at(0),
    );
    await recordPageView(
      db,
      view("v1", "/search?date=2026-10-18", { referrer: "https://bookon.au/" }),
      at(2),
    );
    // Over 30 minutes later: a new visit, straight in.
    await recordPageView(db, view("v1", "/courses/collier-park"), at(40));
    const rows = await db.select().from(pageViews).orderBy(pageViews.at);
    expect(rows.map((r) => [r.path, r.entry, r.channel, r.source])).toEqual([
      ["/", true, "Search", "Google"],
      ["/search", false, null, null],
      ["/courses/collier-park", true, "Direct", "Direct"],
    ]);
    expect(rows[0]!.visitId).toBe(rows[1]!.visitId);
    expect(rows[2]!.visitId).not.toBe(rows[0]!.visitId);
    expect(rows[0]).toMatchObject({ device: "Phone", browser: "Safari", os: "iOS", city: "Perth" });

    await recordTimeOnPage(db, first!, "someone-else", 5000);
    await recordTimeOnPage(db, first!, "v1", 12_000);
    const [timed] = await db.select().from(pageViews).orderBy(pageViews.at).limit(1);
    expect(timed!.durationMs).toBe(12_000);
  });

  it("leaves out portals and bots, and never stores private tokens", async () => {
    const db = handle.db;
    expect(await recordPageView(db, view("v2", "/admin/analytics"), at(0))).toBeNull();
    expect(
      await recordPageView(db, view("v2", "/", { userAgent: "Googlebot/2.1" }), at(0)),
    ).toBeNull();
    await recordPageView(db, view("v2", "/lessons/s3cretT0kenValue"), at(1));
    const rows = await db.select().from(pageViews);
    expect(rows.map((r) => r.path)).toEqual(["/lessons/:link"]);
  });

  it("counts a desktop browser on a phone-sized screen as a phone", async () => {
    await recordPageView(handle.db, view("v3", "/", { userAgent: MAC, width: 400 }), at(0));
    const [row] = await handle.db.select().from(pageViews);
    expect(row!.device).toBe("Phone");
  });

  it("only records known actions and real loading times", async () => {
    const db = handle.db;
    expect(
      await recordEvent(
        db,
        { visitorId: "v4", name: "sort", path: "/search", label: "price" },
        at(0),
      ),
    ).toBe(true);
    expect(
      await recordEvent(db, { visitorId: "v4", name: "hack", path: "/", label: null }, at(0)),
    ).toBe(false);
    expect(
      await recordVital(
        db,
        { name: "LCP", value: 1800, path: "/", userAgent: IPHONE, width: 390 },
        at(0),
      ),
    ).toBe(true);
    expect(
      await recordVital(
        db,
        { name: "XYZ", value: 1, path: "/", userAgent: IPHONE, width: 390 },
        at(0),
      ),
    ).toBe(false);
  });
});

describe("reports", () => {
  async function traffic() {
    const db = handle.db;
    // Alex: Google, three pages, 2 minutes on the first. Bo: Facebook, one page (a bounce).
    const home = await recordPageView(
      db,
      view("alex", "/", { referrer: "https://www.google.com/" }),
      at(0),
    );
    await recordTimeOnPage(db, home!, "alex", 120_000);
    await recordPageView(db, view("alex", "/search"), at(3));
    await recordPageView(db, view("alex", "/courses/collier-park"), at(5));
    await recordPageView(
      db,
      view("bo", "/courses/collier-park", {
        referrer: "https://m.facebook.com/",
        userAgent: MAC,
        width: 1400,
        city: "Fremantle",
      }),
      at(60),
    );
  }

  it("adds up visitors, visits, bounces and time, by Perth day and hour", async () => {
    await traffic();
    const totals = await analyticsTotals(handle.db, day);
    expect(totals).toMatchObject({
      visitors: 2,
      visits: 2,
      views: 4,
      bounceRate: 0.5,
      pagesPerVisit: 2,
    });
    expect(totals.avgVisitMs).toBe(60_000);
    const hours = await visitorSeries(handle.db, day, "hour");
    expect(hours).toHaveLength(24);
    expect(hours.find((h) => h.key === "2026-10-17 07")!.values).toEqual({ visitors: 1, views: 3 });
    expect(hours.find((h) => h.key === "2026-10-17 08")!.values).toEqual({ visitors: 1, views: 1 });
    // The day before is empty.
    expect((await analyticsTotals(handle.db, { from: "2026-10-16", to: "2026-10-16" })).views).toBe(
      0,
    );
  });

  it("lists pages, where visits start and end, sources and devices", async () => {
    await traffic();
    const pages = await pageReport(handle.db, day);
    expect(pages.pages[0]).toMatchObject({ label: "/courses/collier-park", count: 2, visitors: 2 });
    expect(pages.entries.map((e) => [e.label, e.count])).toEqual([
      ["/", 1],
      ["/courses/collier-park", 1],
    ]);
    expect(pages.exits.map((e) => [e.label, e.count])).toEqual([["/courses/collier-park", 2]]);

    const sources = await sourceReport(handle.db, day, "hour");
    expect(sources.channels.map((c) => [c.label, c.count]).sort()).toEqual([
      ["Search", 1],
      ["Social", 1],
    ]);
    expect(sources.series.find((s) => s.key === "2026-10-17 08")!.values.Social).toBe(1);

    const audience = await audienceReport(handle.db, day);
    expect(audience.devices.map((d) => [d.label, d.count]).sort()).toEqual([
      ["Desktop", 1],
      ["Phone", 1],
    ]);
    expect(audience).toMatchObject({ newVisitors: 2, returningVisitors: 0 });
    expect(audience.places.map((p) => p.label).sort()).toEqual(["Fremantle", "Perth"]);

    expect((await liveVisitors(handle.db, at(62))).visitors).toBe(1);
  });

  it("counts returning visitors and weekly cohorts", async () => {
    await recordPageView(handle.db, view("cy", "/"), at(0));
    await recordPageView(handle.db, view("cy", "/"), at(60 * 24 * 7));
    await recordPageView(handle.db, view("di", "/"), at(60 * 24 * 7));
    const week2 = { from: "2026-10-24", to: "2026-10-24" };
    expect(await audienceReport(handle.db, week2)).toMatchObject({
      newVisitors: 1,
      returningVisitors: 1,
    });
    const cohorts = await returnCohorts(handle.db, "2026-10-24", 2);
    expect(cohorts).toEqual([
      { week: "2026-10-12", visitors: 1, returned: [1, 1] },
      { week: "2026-10-19", visitors: 1, returned: [1] },
    ]);
  });

  it("follows visitors from searching to clicking through to a club", async () => {
    await recordPageView(handle.db, view("eve", "/"), at(0));
    await recordPageView(handle.db, view("fin", "/"), at(0));
    const params: SearchParams = {
      dateFrom: "2026-10-18",
      dateTo: "2026-10-18",
      timeFrom: "06:00",
      timeTo: "10:00",
      players: 2,
      holes: 18,
      courseSlugs: null,
    };
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
    await logSearch(handle.db, {
      sessionId: "eve",
      params,
      courseIds: [],
      resultCount: 5,
      shownCourseIds: [collier],
      now: at(1),
    });
    await logSearch(handle.db, {
      sessionId: "fin",
      params: { ...params, players: 4 },
      courseIds: [],
      resultCount: 0,
      shownCourseIds: [],
      now: at(1),
    });
    await logClick(handle.db, {
      sessionId: "eve",
      courseId: collier,
      startTime: at(60 * 24),
      source: "search",
      now: at(2),
    });
    await recordEvent(
      handle.db,
      { visitorId: "eve", name: "sort", path: "/search", label: "price" },
      at(1),
    );

    const report = await teeTimeReport(handle.db, day, "day");
    expect(report).toMatchObject({
      visitors: 2,
      searchers: 2,
      clickers: 1,
      searches: 2,
      emptySearches: 1,
      clicks: 1,
    });
    // Sunday (7), 6 am.
    expect(report.grid).toEqual([{ dow: 7, hour: 6, count: 2 }]);
    expect(report.leadTime).toEqual([{ label: "Tomorrow", detail: null, count: 2 }]);
    expect(report.players.map((p) => [p.label, p.count])).toEqual([
      ["2", 1],
      ["4", 1],
    ]);
    expect(report.actions[0]).toMatchObject({ label: "sort", detail: "price", count: 1 });
    expect(report.courses[0]).toMatchObject({ slug: "collier-park", shown: 1, clicks: 1 });
    expect(report.series).toEqual([{ key: "2026-10-17", values: { searches: 2, clicks: 1 } }]);
  });

  it("works out loading times at the 75th percentile", async () => {
    for (const value of [1000, 2000, 3000, 4000])
      await recordVital(
        handle.db,
        { name: "LCP", value, path: "/", userAgent: IPHONE, width: 390 },
        at(0),
      );
    const speed = await speedReport(handle.db, day);
    expect(speed.overall).toEqual([{ metric: "LCP", group: "All", p75: 3250, samples: 4 }]);
    expect(speed.bySection[0]).toMatchObject({ group: "Home" });
  });

  it("runs the booking and account reports", async () => {
    const funnels = await bookingFunnels(handle.db, day);
    expect(funnels.lessons).toHaveLength(6);
    expect((await accountReport(handle.db, day, "day")).series).toHaveLength(1);
  });

  it("deletes page views older than 13 months", async () => {
    await recordPageView(handle.db, view("old", "/"), new Date("2025-08-01T00:00:00Z"));
    await recordPageView(handle.db, view("new", "/"), at(0));
    expect(await purgeAnalytics(handle.db, at(0))).toBe(1);
    expect((await handle.db.select().from(pageViews)).map((r) => r.visitorId)).toEqual(["new"]);
  });
});

describe("chart buckets", () => {
  it("starts weeks on a Monday", () => {
    expect(bucketKeys({ from: "2026-10-17", to: "2026-10-27" }, "week")).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });
});
