import {
  addPerthDays,
  eachPerthDate,
  perthDate,
  type CourseAdapter,
  type DateRange,
  type HttpClient,
} from "@bookon/core";
import { adapterFor } from "@bookon/adapters";
import {
  finishFetchRun,
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

/** HTTP client that counts what it sends, so each run can record its request count. */
export interface CountingHttpClient extends HttpClient {
  readonly requestCount: number;
}

/** From today in Perth up to the club's booking window. */
export function pollRange(course: PollableCourse, now: Date, maxDays?: number): DateRange {
  const today = perthDate(now);
  const days = Math.max(1, Math.min(course.bookingWindowDays, maxDays ?? Infinity));
  return { from: today, to: addPerthDays(today, days - 1) };
}

/**
 * Read one course and store the result. Never throws: a failing course is
 * recorded and must not stop the others (SPEC section 10).
 */
export async function pollCourse(
  db: Database,
  course: PollableCourse,
  http: CountingHttpClient,
  options: { now?: () => Date; maxDays?: number; adapter?: CourseAdapter } = {},
): Promise<PollResult> {
  const now = options.now ?? (() => new Date());
  const adapter = options.adapter ?? adapterFor(course);
  if (!course.enabled || !adapter) {
    return { course: course.slug, status: "skipped", teeTimes: 0 };
  }

  const startedAt = now();
  const range = pollRange(course, startedAt, options.maxDays);
  const requestsBefore = http.requestCount;
  const runId = await startFetchRun(db, course.id, range.from, range.to, startedAt);

  try {
    const days = await adapter.fetchAvailability(course, range, { http });
    const fetchedAt = now();
    let teeTimes = 0;
    for (const day of days) {
      await saveDayAvailability(db, course.id, day.date, day.teeTimes, fetchedAt);
      teeTimes += day.teeTimes.length;
    }
    await finishFetchRun(
      db,
      runId,
      { status: "ok", requestCount: http.requestCount - requestsBefore, teeTimeCount: teeTimes },
      now(),
    );
    return { course: course.slug, status: "ok", teeTimes };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const failedAt = now();
    await recordDayFailures(db, course.id, eachPerthDate(range.from, range.to), message, failedAt);
    await finishFetchRun(
      db,
      runId,
      {
        status: "error",
        requestCount: http.requestCount - requestsBefore,
        teeTimeCount: 0,
        error: message,
      },
      failedAt,
    );
    return { course: course.slug, status: "error", teeTimes: 0, error: message };
  }
}

/** Poll every course concurrently. The HTTP client keeps requests to each host one at a time. */
export async function pollAll(
  db: Database,
  courses: PollableCourse[],
  http: CountingHttpClient,
  options: { now?: () => Date; maxDays?: number } = {},
): Promise<PollResult[]> {
  const results = await Promise.all(courses.map((course) => pollCourse(db, course, http, options)));
  await pruneOldSnapshots(db, perthDate((options.now ?? (() => new Date()))()));
  return results;
}
