import { and, count, countDistinct, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";
import { addPerthDays, perthDate, perthToUtc, type ClickSource } from "@bookon/core";
import type { Database } from "./client";
import { clickEvents, courses, dailyImpressions, searches } from "./schema";
import type { SearchParams } from "./search";

/** A refresh or double submit within this long counts as the same search. */
export const SEARCH_DEDUPE_MS = 60 * 1000;
/** The same golfer clicking the same slot within this long counts as one click. */
export const CLICK_DEDUPE_MS = 10 * 60 * 1000;

export interface SearchLog {
  sessionId: string;
  params: SearchParams;
  /** Course ids the golfer filtered to; empty means every course. */
  courseIds: string[];
  resultCount: number;
  /** Courses that appeared with at least one tee time. */
  shownCourseIds: string[];
  now: Date;
}

/**
 * Record a search and an impression for each course shown. Returns false,
 * recording nothing, when the same session ran the same search just before.
 */
export async function logSearch(db: Database, log: SearchLog): Promise<boolean> {
  const { params } = log;
  const recent = await db
    .select()
    .from(searches)
    .where(
      and(
        eq(searches.anonymousSessionId, log.sessionId),
        gte(searches.createdAt, new Date(log.now.getTime() - SEARCH_DEDUPE_MS)),
      ),
    );
  const same = recent.some(
    (s) =>
      s.dateFrom === params.dateFrom &&
      s.dateTo === params.dateTo &&
      s.timeFrom.slice(0, 5) === params.timeFrom &&
      s.timeTo.slice(0, 5) === params.timeTo &&
      s.players === params.players &&
      s.holes === params.holes &&
      [...s.courseIds].sort().join() === [...log.courseIds].sort().join(),
  );
  if (same) return false;

  await db.insert(searches).values({
    createdAt: log.now,
    anonymousSessionId: log.sessionId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
    players: params.players,
    holes: params.holes,
    courseIds: log.courseIds,
    resultCount: log.resultCount,
  });

  if (log.shownCourseIds.length > 0) {
    await db
      .insert(dailyImpressions)
      .values(
        log.shownCourseIds.map((courseId) => ({
          courseId,
          day: perthDate(log.now),
          impressions: 1,
        })),
      )
      .onConflictDoUpdate({
        target: [dailyImpressions.courseId, dailyImpressions.day],
        set: { impressions: sql`${dailyImpressions.impressions} + 1` },
      });
  }
  return true;
}

export interface ClickLog {
  sessionId: string | null;
  courseId: string;
  startTime: Date | null;
  source: ClickSource;
  notificationId?: string | null;
  /** The signed-in golfer, for their previous visits. */
  userId?: string | null;
  now: Date;
}

/** Record a click through to a club. Returns false for a repeat click on the same slot. */
export async function logClick(db: Database, log: ClickLog): Promise<boolean> {
  if (log.sessionId) {
    const [repeat] = await db
      .select({ id: clickEvents.id })
      .from(clickEvents)
      .where(
        and(
          eq(clickEvents.anonymousSessionId, log.sessionId),
          eq(clickEvents.courseId, log.courseId),
          log.startTime
            ? eq(clickEvents.startTime, log.startTime)
            : sql`${clickEvents.startTime} is null`,
          gte(clickEvents.createdAt, new Date(log.now.getTime() - CLICK_DEDUPE_MS)),
        ),
      )
      .limit(1);
    if (repeat) return false;
  }

  await db.insert(clickEvents).values({
    createdAt: log.now,
    anonymousSessionId: log.sessionId,
    courseId: log.courseId,
    startTime: log.startTime,
    source: log.source,
    notificationId: log.notificationId ?? null,
    userId: log.userId ?? null,
  });
  return true;
}

/** Hosts a course's Book links may lead to: its booking page and its platform site. */
export async function bookingHostsFor(db: Database, courseId: string): Promise<string[]> {
  const [course] = await db
    .select({ bookingUrl: courses.bookingUrl, platformConfig: courses.platformConfig })
    .from(courses)
    .where(eq(courses.id, courseId));
  if (!course) return [];
  const urls = [course.bookingUrl, course.platformConfig.baseUrl].filter(
    (u): u is string => typeof u === "string",
  );
  return [...new Set(urls.map((u) => new URL(u).host))];
}

export interface CourseActivity {
  courseId: string;
  slug: string;
  name: string;
  /** Searches that covered this course: all-course searches plus those that picked it. */
  searches: number;
  impressions: number;
  clicks: number;
  /** Distinct anonymous visitors who clicked through. */
  golfers: number;
  alertClicks: number;
  /** Clicks from a list of times a golfer shared with mates. */
  shareClicks: number;
}

/** Activity per course for Perth dates `from` to `to` inclusive. Feeds the club report. */
export async function courseActivity(
  db: Database,
  from: string,
  to: string,
): Promise<CourseActivity[]> {
  const start = perthToUtc(from, "00:00");
  const end = perthToUtc(addPerthDays(to, 1), "00:00");
  const inRange = (column: typeof searches.createdAt | typeof clickEvents.createdAt) =>
    and(gte(column, start), lt(column, end));

  const courseRows = await db
    .select({ id: courses.id, slug: courses.slug, name: courses.name })
    .from(courses)
    .orderBy(courses.name);

  const [allCourseSearches] = await db
    .select({ n: count() })
    .from(searches)
    .where(and(inRange(searches.createdAt), sql`cardinality(${searches.courseIds}) = 0`));

  const picked = await db
    .select({ courseId: sql<string>`unnest(${searches.courseIds})`.as("course_id"), n: count() })
    .from(searches)
    .where(inRange(searches.createdAt))
    .groupBy(sql`1`);

  const impressions = await db
    .select({ courseId: dailyImpressions.courseId, n: sum(dailyImpressions.impressions) })
    .from(dailyImpressions)
    .where(and(gte(dailyImpressions.day, from), sql`${dailyImpressions.day} <= ${to}`))
    .groupBy(dailyImpressions.courseId);

  const clicks = await db
    .select({
      courseId: clickEvents.courseId,
      n: count(),
      golfers: countDistinct(clickEvents.anonymousSessionId),
      alert: sql<number>`count(*) filter (where ${clickEvents.source} = 'alert')`.mapWith(Number),
      share: sql<number>`count(*) filter (where ${clickEvents.source} = 'share')`.mapWith(Number),
    })
    .from(clickEvents)
    .where(inRange(clickEvents.createdAt))
    .groupBy(clickEvents.courseId);

  return courseRows.map((c) => {
    const click = clicks.find((r) => r.courseId === c.id);
    return {
      courseId: c.id,
      slug: c.slug,
      name: c.name,
      searches: (allCourseSearches?.n ?? 0) + (picked.find((r) => r.courseId === c.id)?.n ?? 0),
      impressions: Number(impressions.find((r) => r.courseId === c.id)?.n ?? 0),
      clicks: click?.n ?? 0,
      golfers: click?.golfers ?? 0,
      alertClicks: click?.alert ?? 0,
      shareClicks: click?.share ?? 0,
    };
  });
}

/** Course ids for a set of slugs, for logging which courses a search was limited to. */
export async function courseIdsForSlugs(db: Database, slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(inArray(courses.slug, slugs));
  return rows.map((r) => r.id);
}
