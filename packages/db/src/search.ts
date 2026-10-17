import { and, between, eq, gt, gte, inArray, lte, or } from "drizzle-orm";
import { addPerthDays, eachPerthDate, perthDate, perthToUtc } from "@bookon/core";
import type { Database } from "./client";
import { availabilityChecks, availabilitySnapshots, courses } from "./schema";

/** A day's results are only shown if checked successfully within this long. */
export const STALE_AFTER_MS = 90 * 60 * 1000;

export interface SearchParams {
  /** Perth dates, YYYY-MM-DD, inclusive. */
  dateFrom: string;
  dateTo: string;
  /** Perth wall-clock times, HH:mm, inclusive. */
  timeFrom: string;
  timeTo: string;
  players: number;
  holes: 9 | 18 | null;
  /** Course slugs to include, or null for every searchable course. */
  courseSlugs: string[] | null;
}

export interface ResultTeeTime {
  startTime: Date;
  playDate: string;
  holes: number;
  layout: string | null;
  spotsAvailable: number;
  priceCents: number | null;
  bookingUrl: string;
}

/** Why a course has no results for a date, when it is not simply "nothing matched". */
export type DayNotice =
  | { date: string; kind: "stale"; lastSuccessAt: Date | null }
  | { date: string; kind: "not-checked" }
  | { date: string; kind: "not-open"; opensOn: string };

export interface CourseResult {
  course: { id: string; slug: string; name: string; suburb: string; bookingUrl: string };
  teeTimes: ResultTeeTime[];
  /** Oldest successful check among the fresh days searched, for the "last checked" label. */
  checkedAt: Date | null;
  notices: DayNotice[];
}

export interface SearchResult {
  courses: CourseResult[];
  totalTeeTimes: number;
}

export interface SearchableCourse {
  id: string;
  slug: string;
  name: string;
  suburb: string;
}

/** Courses that can appear in search, for the course filter. */
export async function listSearchableCourses(db: Database): Promise<SearchableCourse[]> {
  return db
    .select({ id: courses.id, slug: courses.slug, name: courses.name, suburb: courses.suburb })
    .from(courses)
    .where(eq(courses.enabled, true))
    .orderBy(courses.name);
}

export async function searchTeeTimes(
  db: Database,
  params: SearchParams,
  now: Date,
  staleAfterMs = STALE_AFTER_MS,
): Promise<SearchResult> {
  const courseRows = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.enabled, true),
        params.courseSlugs ? inArray(courses.slug, params.courseSlugs) : undefined,
      ),
    )
    .orderBy(courses.name);
  if (courseRows.length === 0) return { courses: [], totalTeeTimes: 0 };

  const courseIds = courseRows.map((c) => c.id);
  const dates = eachPerthDate(params.dateFrom, params.dateTo);
  const today = perthDate(now);

  // Sequential on purpose: the local PGlite server mixes up overlapping queries on one connection.
  const checks = await db
    .select()
    .from(availabilityChecks)
    .where(
      and(
        inArray(availabilityChecks.courseId, courseIds),
        between(availabilityChecks.playDate, params.dateFrom, params.dateTo),
      ),
    );
  const snapshots = await db
    .select()
    .from(availabilitySnapshots)
    .where(
      and(
        inArray(availabilitySnapshots.courseId, courseIds),
        between(availabilitySnapshots.playDate, params.dateFrom, params.dateTo),
        gt(availabilitySnapshots.startTime, now),
        gte(availabilitySnapshots.spotsAvailable, params.players),
        lte(availabilitySnapshots.minPlayers, params.players),
        params.holes ? eq(availabilitySnapshots.holes, params.holes) : undefined,
        // The golfer's time window on each day, so rows outside it never leave the database.
        or(
          ...dates.map((date) =>
            between(
              availabilitySnapshots.startTime,
              perthToUtc(date, params.timeFrom),
              perthToUtc(date, params.timeTo),
            ),
          ),
        ),
      ),
    )
    .orderBy(availabilitySnapshots.startTime);

  // Grouped once, rather than scanning every row for every course.
  const checkFor = new Map(checks.map((c) => [`${c.courseId}|${c.playDate}`, c]));
  const snapshotsFor = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const list = snapshotsFor.get(s.courseId);
    if (list) list.push(s);
    else snapshotsFor.set(s.courseId, [s]);
  }

  const results: CourseResult[] = courseRows.map((course) => {
    const lastOpenDate = addPerthDays(today, course.bookingWindowDays - 1);
    const notices: DayNotice[] = [];
    const freshDates = new Set<string>();
    let checkedAt: Date | null = null;

    for (const date of dates) {
      if (date > lastOpenDate) {
        notices.push({
          date,
          kind: "not-open",
          opensOn: addPerthDays(date, -(course.bookingWindowDays - 1)),
        });
        continue;
      }
      const check = checkFor.get(`${course.id}|${date}`);
      if (!check) {
        notices.push({ date, kind: "not-checked" });
      } else if (
        check.lastSuccessAt &&
        now.getTime() - check.lastSuccessAt.getTime() <= staleAfterMs
      ) {
        freshDates.add(date);
        if (!checkedAt || check.lastSuccessAt < checkedAt) checkedAt = check.lastSuccessAt;
      } else {
        notices.push({ date, kind: "stale", lastSuccessAt: check.lastSuccessAt });
      }
    }

    const teeTimes = (snapshotsFor.get(course.id) ?? [])
      .filter((s) => freshDates.has(s.playDate))
      .map((s) => ({
        startTime: s.startTime,
        playDate: s.playDate,
        holes: s.holes,
        layout: s.layout,
        spotsAvailable: s.spotsAvailable,
        priceCents: s.priceCents,
        bookingUrl: s.bookingUrl ?? course.bookingUrl,
      }));

    return {
      course: {
        id: course.id,
        slug: course.slug,
        name: course.name,
        suburb: course.suburb,
        bookingUrl: course.bookingUrl,
      },
      teeTimes,
      checkedAt,
      notices,
    };
  });

  // Courses with times first, earliest first; the rest keep alphabetical order.
  results.sort((a, b) => {
    const first = (r: CourseResult) =>
      r.teeTimes[0]?.startTime.getTime() ?? Number.MAX_SAFE_INTEGER;
    return first(a) - first(b);
  });

  return { courses: results, totalTeeTimes: results.reduce((n, r) => n + r.teeTimes.length, 0) };
}
