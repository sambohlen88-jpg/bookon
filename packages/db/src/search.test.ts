import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TeeTime } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug, recordDayFailures, saveDayAvailability } from "./queries";
import { availabilityChecks, availabilitySnapshots } from "./schema";
import {
  checkProblem,
  listSearchableCourses,
  nextTeeTimes,
  searchTeeTimes,
  type SearchParams,
} from "./search";
import { seed } from "./seed";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const checkedAt = new Date("2026-10-16T22:45:00Z");

let handle: DbHandle;
let collier: string;
let hamersley: string;
let sims: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
  hamersley = (await findCourseBySlug(handle.db, "hamersley"))!.id;
  sims = (await findCourseBySlug(handle.db, "outtabounds-simulators"))!.id;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(availabilitySnapshots);
  await handle.db.delete(availabilityChecks);
});

function slot(courseId: string, perthIso: string, overrides: Partial<TeeTime> = {}): TeeTime {
  return {
    courseId,
    startTime: new Date(`${perthIso}+08:00`),
    holes: 18,
    layout: null,
    spotsAvailable: 4,
    minPlayers: 1,
    priceCents: 4000,
    sourceUrl: "https://example.com/source",
    bookingUrl: `https://example.com/book/${perthIso}`,
    ...overrides,
  };
}

const base: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: null,
  courseSlugs: null,
};

function times(result: Awaited<ReturnType<typeof searchTeeTimes>>, slug: string) {
  return result.courses
    .find((c) => c.course.slug === slug)!
    .teeTimes.map((t) => t.startTime.toISOString());
}

describe("searchTeeTimes", () => {
  it("filters by time window, group size and holes, earliest course first", async () => {
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [
        slot(collier, "2026-10-18T05:52:00"), // before the window
        slot(collier, "2026-10-18T08:00:00"),
        slot(collier, "2026-10-18T09:00:00", { spotsAvailable: 1 }), // too few spots for 2
        slot(collier, "2026-10-18T10:00:00", { holes: 9 }),
        slot(collier, "2026-10-18T12:00:00"), // inclusive end
        slot(collier, "2026-10-18T12:01:00"), // after the window
      ],
      checkedAt,
    );
    await saveDayAvailability(
      handle.db,
      hamersley,
      "2026-10-18",
      [
        slot(hamersley, "2026-10-18T07:00:00", { minPlayers: 3 }),
        slot(hamersley, "2026-10-18T07:30:00"),
      ],
      checkedAt,
    );

    const result = await searchTeeTimes(handle.db, base, now);
    // Courses with matching times come first, earliest first; the rest follow.
    expect(result.courses.map((c) => c.course.slug).slice(0, 2)).toEqual([
      "hamersley",
      "collier-park",
    ]);
    expect(result.courses.slice(2).every((c) => c.teeTimes.length === 0)).toBe(true);
    expect(times(result, "hamersley")).toEqual(["2026-10-17T23:30:00.000Z"]);
    expect(times(result, "collier-park")).toEqual([
      "2026-10-18T00:00:00.000Z",
      "2026-10-18T02:00:00.000Z",
      "2026-10-18T04:00:00.000Z",
    ]);
    expect(result.totalTeeTimes).toBe(4);

    const eighteens = await searchTeeTimes(
      handle.db,
      { ...base, holes: 18, courseSlugs: ["collier-park"] },
      now,
    );
    expect(eighteens.courses).toHaveLength(1);
    expect(eighteens.totalTeeTimes).toBe(2);
  });

  it("hides times that have already passed today", async () => {
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-17",
      [slot(collier, "2026-10-17T06:30:00"), slot(collier, "2026-10-17T07:30:00")],
      checkedAt,
    );
    const result = await searchTeeTimes(
      handle.db,
      { ...base, dateFrom: "2026-10-17", dateTo: "2026-10-17" },
      now,
    );
    expect(times(result, "collier-park")).toEqual(["2026-10-16T23:30:00.000Z"]);
  });

  it("shows a notice instead of old results when a day is stale or failing", async () => {
    const old = new Date("2026-10-16T20:00:00Z"); // three hours before now
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot(collier, "2026-10-18T08:00:00")],
      old,
    );
    await recordDayFailures(
      handle.db,
      collier,
      ["2026-10-18"],
      "HttpError: HTTP 503 for https://example.com",
      checkedAt,
    );

    const result = await searchTeeTimes(handle.db, { ...base, courseSlugs: ["collier-park"] }, now);
    const [course] = result.courses;
    expect(course!.teeTimes).toEqual([]);
    expect(course!.checkedAt).toBeNull();
    expect(course!.notices).toEqual([
      { date: "2026-10-18", kind: "stale", lastSuccessAt: old, problem: "site-down" },
    ]);
  });

  it("knows a course that's fully booked from one with nothing matching", async () => {
    await saveDayAvailability(handle.db, collier, "2026-10-18", [], checkedAt);
    await saveDayAvailability(
      handle.db,
      hamersley,
      "2026-10-18",
      [slot(hamersley, "2026-10-18T15:00:00")],
      checkedAt,
    );
    const result = await searchTeeTimes(
      handle.db,
      { ...base, courseSlugs: ["collier-park", "hamersley"] },
      now,
    );
    const status = Object.fromEntries(
      result.courses.map((c) => [
        c.course.slug,
        { times: c.teeTimes.length, booked: c.fullyBooked },
      ]),
    );
    expect(status).toEqual({
      "collier-park": { times: 0, booked: true },
      // A 3 pm time doesn't match a morning search, but the course isn't booked out.
      hamersley: { times: 0, booked: false },
    });
  });

  it("still shows a fresh day after a later failed attempt", async () => {
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot(collier, "2026-10-18T08:00:00")],
      checkedAt,
    );
    await recordDayFailures(
      handle.db,
      collier,
      ["2026-10-18"],
      "timeout",
      new Date("2026-10-16T22:55:00Z"),
    );
    const result = await searchTeeTimes(handle.db, { ...base, courseSlugs: ["collier-park"] }, now);
    expect(result.courses[0]!.teeTimes).toHaveLength(1);
    expect(result.courses[0]!.checkedAt).toEqual(checkedAt);
  });

  it("says when times open for days beyond the club's booking window", async () => {
    // Collier Park opens 8 days ahead: 17 to 24 October are open on the 17th.
    const result = await searchTeeTimes(
      handle.db,
      { ...base, dateFrom: "2026-10-24", dateTo: "2026-10-26", courseSlugs: ["collier-park"] },
      now,
    );
    expect(result.courses[0]!.notices).toEqual([
      { date: "2026-10-24", kind: "not-checked" },
      { date: "2026-10-25", kind: "not-open", opensOn: "2026-10-18" },
      { date: "2026-10-26", kind: "not-open", opensOn: "2026-10-19" },
    ]);
  });

  it("never includes switched off courses", async () => {
    const result = await searchTeeTimes(handle.db, { ...base, courseSlugs: ["wembley"] }, now);
    expect(result.courses).toEqual([]);
  });
});

describe("simulator and range bays", () => {
  function bay(label: string, perthIso: string, overrides: Partial<TeeTime> = {}): TeeTime {
    return slot(sims, perthIso, {
      holes: 0,
      bay: label,
      durations: [60, 90, 120],
      spotsAvailable: 6,
      priceCents: 4000,
      bookingUrl: "https://yourgolfbooking.com/venues/outta-bounds/booking/simulators",
      ...overrides,
    });
  }

  beforeEach(async () => {
    await saveDayAvailability(
      handle.db,
      sims,
      "2026-10-18",
      [
        bay("s2", "2026-10-18T09:00:00"),
        bay("s3", "2026-10-18T09:00:00", { priceCents: 2500 }),
        bay("s4", "2026-10-18T09:00:00", { durations: [60] }),
        bay("s2", "2026-10-18T09:30:00", { durations: [60] }),
      ],
      checkedAt,
    );
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot(collier, "2026-10-18T09:00:00")],
      checkedAt,
    );
  });

  it("stay out of golf searches, so alerts never pick them up", async () => {
    const result = await searchTeeTimes(handle.db, base, now);
    expect(result.courses.map((c) => c.course.kind)).not.toContain("simulator");
    expect(times(result, "collier-park")).toHaveLength(1);
  });

  it("list each start once, with its free bays and cheapest hourly price", async () => {
    const result = await searchTeeTimes(handle.db, { ...base, play: "bays", minutes: 60 }, now);
    expect(result.courses.every((c) => c.course.kind !== "course")).toBe(true);
    const venue = result.courses.find((c) => c.course.slug === "outtabounds-simulators")!;
    expect(venue.teeTimes).toMatchObject([
      { holes: 0, bays: ["s2", "s3", "s4"], priceCents: 2500, spotsAvailable: 6 },
      { holes: 0, bays: ["s2"] },
    ]);
    expect(result.totalTeeTimes).toBe(2);
  });

  it("only list bays free for the whole session", async () => {
    const result = await searchTeeTimes(handle.db, { ...base, play: "bays", minutes: 120 }, now);
    const venue = result.courses.find((c) => c.course.slug === "outtabounds-simulators")!;
    expect(venue.teeTimes.map((t) => t.bays)).toEqual([["s2", "s3"]]);
  });

  it("can be listed beside golf courses", async () => {
    const result = await nextTeeTimes(handle.db, now, {
      courseSlugs: ["collier-park", "outtabounds-simulators"],
      play: "all",
    });
    expect(result.map((c) => c.teeTimes.length).sort()).toEqual([1, 2]);
  });
});

describe("listSearchableCourses", () => {
  it("lists only switched on courses", async () => {
    const slugs = (await listSearchableCourses(handle.db)).map((c) => c.slug);
    expect(slugs).toHaveLength(31);
    expect(slugs).not.toContain("wembley");
  });
});

describe("checkProblem", () => {
  it("sorts saved check errors into reasons a golfer understands", () => {
    expect(checkProblem("CaptchaRequiredError: Wembley asks for a CAPTCHA")).toBe("blocked");
    expect(
      checkProblem("RobotsDisallowedError: robots.txt disallows BookOnBot, so not fetching x"),
    ).toBe("blocked");
    expect(checkProblem("HttpError: HTTP 403 for https://x")).toBe("blocked");
    expect(checkProblem("HttpError: HTTP 503 for https://x")).toBe("site-down");
    expect(checkProblem("HttpError: HTTP 429 for https://x")).toBe("site-down");
    expect(checkProblem("TypeError: fetch failed")).toBe("site-down");
    expect(checkProblem("TimeoutError: The operation was aborted due to timeout")).toBe(
      "site-down",
    );
    expect(
      checkProblem(
        "RobotsDisallowedError: robots.txt could not be read (HTTP 500), so not fetching x",
      ),
    ).toBe("site-down");
    expect(checkProblem("HttpError: HTTP 404 for https://x")).toBe("unreadable");
    expect(checkProblem("PageFormatError: no timesheet table")).toBe("unreadable");
    expect(checkProblem(null)).toBe("old");
  });
});

describe("nextTeeTimes", () => {
  it("lists times from 15 minutes from now, today and tomorrow", async () => {
    // now is 7:00 am Perth on Saturday 17 October.
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-17",
      [
        slot(collier, "2026-10-17T06:30:00"), // already gone
        slot(collier, "2026-10-17T07:10:00"), // too soon to get there
        slot(collier, "2026-10-17T07:20:00"),
      ],
      checkedAt,
    );
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot(collier, "2026-10-18T06:00:00")],
      checkedAt,
    );
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-19",
      [slot(collier, "2026-10-19T06:00:00")],
      checkedAt,
    );
    const result = await nextTeeTimes(handle.db, now, { courseSlugs: ["collier-park"] });
    expect(times({ courses: result, totalTeeTimes: 0 }, "collier-park")).toEqual([
      new Date("2026-10-17T07:20:00+08:00").toISOString(),
      new Date("2026-10-18T06:00:00+08:00").toISOString(),
    ]);
  });
});
