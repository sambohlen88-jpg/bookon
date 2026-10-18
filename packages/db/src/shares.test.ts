import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TeeTime } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug, saveDayAvailability } from "./queries";
import { availabilityChecks, availabilitySnapshots, sharedSearches } from "./schema";
import { searchTeeTimes, type SearchParams } from "./search";
import { seed } from "./seed";
import {
  SHARE_LIMIT_PER_HOUR,
  SHARE_TIMES_PER_COURSE,
  createShare,
  pruneExpiredShares,
  shareByCode,
  shareContentFrom,
  sharedTimeKey,
  sharedTimeStatuses,
} from "./shares";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const checkedAt = new Date("2026-10-16T22:45:00Z");

let handle: DbHandle;
let collier: string;
let whaleback: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
  whaleback = (await findCourseBySlug(handle.db, "whaleback"))!.id;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(availabilitySnapshots);
  await handle.db.delete(availabilityChecks);
  await handle.db.delete(sharedSearches);
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

const params: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: null,
  courseSlugs: ["collier-park", "whaleback"],
};

async function sampleShare() {
  await saveDayAvailability(
    handle.db,
    collier,
    "2026-10-18",
    [slot(collier, "2026-10-18T09:00:00"), slot(collier, "2026-10-18T10:00:00")],
    checkedAt,
  );
  await saveDayAvailability(
    handle.db,
    whaleback,
    "2026-10-18",
    [slot(whaleback, "2026-10-18T07:30:00")],
    checkedAt,
  );
  const result = await searchTeeTimes(handle.db, params, now);
  return shareContentFrom(result, params, "?date=2026-10-18&players=2");
}

describe("shareContentFrom", () => {
  it("keeps courses with times, earliest course first, and trims long lists", async () => {
    const content = await sampleShare();
    expect(content.query).toBe("date=2026-10-18&players=2");
    expect(content.courses.map((c) => c.slug)).toEqual(["whaleback", "collier-park"]);
    expect(content.totalTeeTimes).toBe(3);

    const many = Array.from({ length: SHARE_TIMES_PER_COURSE + 5 }, (_, i) =>
      slot(collier, `2026-10-18T06:${String(i % 60).padStart(2, "0")}:00`, {
        holes: i < 60 ? 18 : 9,
      }),
    );
    await saveDayAvailability(handle.db, collier, "2026-10-18", many, checkedAt);
    const big = shareContentFrom(
      await searchTeeTimes(handle.db, { ...params, timeTo: "07:00" }, now),
      params,
      "",
    );
    const course = big.courses.find((c) => c.slug === "collier-park")!;
    expect(course.total).toBe(SHARE_TIMES_PER_COURSE + 5);
    expect(course.teeTimes).toHaveLength(SHARE_TIMES_PER_COURSE);
  });
});

describe("createShare and shareByCode", () => {
  it("saves a share that reads back until a week after the play date", async () => {
    const content = await sampleShare();
    const made = await createShare(handle.db, { sessionId: "s1", content, now });
    if (!("code" in made)) throw new Error("expected a code");
    expect(made.code).toMatch(/^[A-Za-z0-9_-]{11}$/);

    const share = await shareByCode(handle.db, made.code, now);
    expect(share?.courses.map((c) => c.slug)).toEqual(["whaleback", "collier-park"]);
    expect(share?.params).toEqual(params);
    // Midnight Perth at the start of 26 October.
    expect(share?.expiresAt.toISOString()).toBe("2026-10-25T16:00:00.000Z");

    const later = new Date("2026-10-25T16:00:01Z");
    expect(await shareByCode(handle.db, made.code, later)).toBeNull();
    await pruneExpiredShares(handle.db, later);
    expect(await handle.db.select().from(sharedSearches)).toHaveLength(0);
  });

  it("gives the same link for the same search, and limits how many one visitor makes", async () => {
    const content = await sampleShare();
    const first = await createShare(handle.db, { sessionId: "s1", content, now });
    const again = await createShare(handle.db, { sessionId: "s1", content, now });
    expect(again).toEqual(first);
    const other = await createShare(handle.db, { sessionId: "s2", content, now });
    expect(other).not.toEqual(first);

    for (let i = 1; i < SHARE_LIMIT_PER_HOUR; i++) {
      await createShare(handle.db, {
        sessionId: "s1",
        content: { ...content, query: `n=${i}` },
        now,
      });
    }
    expect(
      await createShare(handle.db, { sessionId: "s1", content: { ...content, query: "x" }, now }),
    ).toEqual({ error: "limit" });
  });

  it("won't share an empty list, and ignores codes that can't be right", async () => {
    const empty = shareContentFrom({ courses: [], totalTeeTimes: 0 }, params, "");
    expect(await createShare(handle.db, { sessionId: "s1", content: empty, now })).toEqual({
      error: "empty",
    });
    expect(await shareByCode(handle.db, "../../etc", now)).toBeNull();
  });
});

describe("sharedTimeStatuses", () => {
  it("marks times booked since, passed, or not checked recently", async () => {
    const content = await sampleShare();
    // Collier Park's 9:00 has been booked; Whaleback hasn't been checked since.
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot(collier, "2026-10-18T10:00:00")],
      new Date("2026-10-17T00:30:00Z"),
    );
    const later = new Date("2026-10-17T01:00:00Z");
    const current = await searchTeeTimes(handle.db, params, later);
    const statuses = sharedTimeStatuses(content, current, later);
    const status = (courseId: string, perth: string) =>
      statuses.get(
        sharedTimeKey(courseId, { startTime: new Date(`${perth}+08:00`).toISOString(), holes: 18 }),
      );
    expect(status(collier, "2026-10-18T09:00:00")).toBe("gone");
    expect(status(collier, "2026-10-18T10:00:00")).toBe("open");
    expect(status(whaleback, "2026-10-18T07:30:00")).toBe("unknown");

    // Once the time has passed, it's gone whatever the club's page says.
    const after = new Date("2026-10-18T02:30:00Z");
    expect(
      sharedTimeStatuses(content, current, after).get(
        sharedTimeKey(collier, {
          startTime: new Date("2026-10-18T10:00:00+08:00").toISOString(),
          holes: 18,
        }),
      ),
    ).toBe("gone");
  });
});
