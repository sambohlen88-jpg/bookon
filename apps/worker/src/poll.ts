import {
  addPerthDays,
  eachPerthDate,
  perthDate,
  type CourseAdapter,
  type DateRange,
  type HttpClient,
  type Platform,
} from "@bookon/core";
import { adapterFor } from "@bookon/adapters";
import {
  finishFetchRun,
  pruneExpiredShares,
  pruneOldSnapshots,
  recordDayFailures,
  saveDayAvailability,
  startFetchRun,
  type Database,
  type PollableCourse,
} from "@bookon/db";

export interface PollResult {
  course: string;
  status: "ok" | "error" | "skipped";
  teeTimes: number;
  error?: string;
}

/**
 * Platforms BookOn doesn't read for now. MiClub (27 October 2026): MiClub
 * said it doesn't endorse automated reading of timesheets and isn't taking new
 * integrations until about the end of Q1 2027, so the owner paused it. See
 * docs/platforms.md. Their courses stay on the site; only the reading stops.
 */
export const PAUSED_PLATFORMS: readonly Platform[] = ["miclub"];

/** Counts the pages one course requests, as courses share one HTTP client and poll in parallel. */
function countingClient(http: HttpClient): HttpClient & { count: number } {
  const counted = {
    count: 0,
    getText(url: string) {
      counted.count++;
      return http.getText(url);
    },
  };
  return counted;
}

/** From today in Perth up to the club's booking window, or `days` when given (for testing a course). */
export function pollRange(course: PollableCourse, now: Date, days?: number): DateRange {
  const today = perthDate(now);
  const count = Math.max(1, days ?? course.bookingWindowDays);
  return { from: today, to: addPerthDays(today, count - 1) };
}

/**
 * Runs database work one piece at a time. Fetching from club sites stays
 * parallel, but 26 courses writing at once hung the local PGlite server,
 * and one writer at a time is plenty for Postgres too.
 */
let dbQueue: Promise<unknown> = Promise.resolve();
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = dbQueue.then(work, work);
  dbQueue = next.catch(() => undefined);
  return next;
}

/**
 * Read one course and store the result. Never throws: a failing course is
 * recorded and must not stop the others (SPEC section 10).
 */
export async function pollCourse(
  db: Database,
  course: PollableCourse,
  http: HttpClient,
  options: { now?: () => Date; days?: number; adapter?: CourseAdapter } = {},
): Promise<PollResult> {
  const now = options.now ?? (() => new Date());
  const adapter = options.adapter ?? adapterFor(course);
  if (!course.enabled || !adapter) {
    return { course: course.slug, status: "skipped", teeTimes: 0 };
  }

  const startedAt = now();
  const range = pollRange(course, startedAt, options.days);
  const counted = countingClient(http);
  const runId = await exclusive(() =>
    startFetchRun(db, course.id, range.from, range.to, startedAt),
  );

  try {
    const days = await adapter.fetchAvailability(course, range, { http: counted, now: startedAt });
    const fetchedAt = now();
    const teeTimes = days.reduce((n, day) => n + day.teeTimes.length, 0);
    await exclusive(async () => {
      for (const day of days) {
        await saveDayAvailability(db, course.id, day.date, day.teeTimes, fetchedAt);
      }
      await finishFetchRun(
        db,
        runId,
        { status: "ok", requestCount: counted.count, teeTimeCount: teeTimes },
        now(),
      );
    });
    return { course: course.slug, status: "ok", teeTimes };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const failedAt = now();
    await exclusive(async () => {
      await recordDayFailures(
        db,
        course.id,
        eachPerthDate(range.from, range.to),
        message,
        failedAt,
      );
      await finishFetchRun(
        db,
        runId,
        { status: "error", requestCount: counted.count, teeTimeCount: 0, error: message },
        failedAt,
      );
    });
    return { course: course.slug, status: "error", teeTimes: 0, error: message };
  }
}

/** Poll every course concurrently. The HTTP client keeps requests to each host one at a time. */
export async function pollAll(
  db: Database,
  courses: PollableCourse[],
  http: HttpClient,
  options: { now?: () => Date; days?: number; pausedPlatforms?: readonly Platform[] } = {},
): Promise<PollResult[]> {
  const paused = options.pausedPlatforms ?? PAUSED_PLATFORMS;
  const results = await Promise.all(
    courses.map((course) =>
      paused.includes(course.platform)
        ? Promise.resolve<PollResult>({
            course: course.slug,
            status: "skipped",
            teeTimes: 0,
            error: `${course.platform} reading is paused`,
          })
        : pollCourse(db, course, http, options),
    ),
  );
  const now = (options.now ?? (() => new Date()))();
  await exclusive(() => pruneOldSnapshots(db, perthDate(now), now));
  await exclusive(() => pruneExpiredShares(db, now));
  return results;
}
