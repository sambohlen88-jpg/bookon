import { and, eq, inArray, sql } from "drizzle-orm";
import type { Course, TeeTime } from "@bookon/core";
import type { Database } from "./client";
import { availabilityChecks, availabilitySnapshots, courses, fetchRuns } from "./schema";

export type CourseRow = typeof courses.$inferSelect;

export interface PollableCourse extends Course {
  bookingWindowDays: number;
}

export function toCourse(row: CourseRow): PollableCourse {
  return {
    id: row.id,
    clubId: row.clubId,
    name: row.name,
    slug: row.slug,
    suburb: row.suburb,
    latitude: row.latitude,
    longitude: row.longitude,
    holes: row.holes,
    kind: row.kind,
    platform: row.platform,
    platformConfig: row.platformConfig,
    websiteUrl: row.websiteUrl,
    bookingUrl: row.bookingUrl,
    enabled: row.enabled,
    notes: row.notes,
    bookingWindowDays: row.bookingWindowDays,
  };
}

export async function listEnabledCourses(db: Database): Promise<PollableCourse[]> {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.enabled, true))
    .orderBy(courses.name);
  return rows.map(toCourse);
}

export async function findCourseBySlug(db: Database, slug: string): Promise<PollableCourse | null> {
  const [row] = await db.select().from(courses).where(eq(courses.slug, slug));
  return row ? toCourse(row) : null;
}

/** A tee time counts as unbooked if a check this soon before it started still saw it free. */
export const UNBOOKED_WINDOW_MINUTES = 60;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Keep the tee times about to be cleared away that started (by `now`) while
 * still free: seen free by a check within the hour before they started.
 * Golf courses only.
 */
async function recordUnbooked(
  tx: Database | Tx,
  where: ReturnType<typeof sql>,
  now: Date,
): Promise<void> {
  await tx.execute(sql`
    insert into unbooked_slots (course_id, play_date, start_time, holes, layout, spots_left, price_cents, last_seen_at)
    select s.course_id, s.play_date, s.start_time, s.holes, s.layout, s.spots_available, s.price_cents, s.fetched_at
    from availability_snapshots s
    join courses c on c.id = s.course_id and c.kind = 'course'
    where ${where}
      and s.start_time <= ${now.toISOString()}::timestamptz
      and s.fetched_at < s.start_time
      and s.fetched_at >= s.start_time - make_interval(mins => ${UNBOOKED_WINDOW_MINUTES}::int)
    on conflict do nothing`);
}

/** Replace one course and date's availability with a fresh, complete read. */
export async function saveDayAvailability(
  db: Database,
  courseId: string,
  playDate: string,
  teeTimes: TeeTime[],
  fetchedAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await recordUnbooked(
      tx,
      sql`s.course_id = ${courseId} and s.play_date = ${playDate}`,
      fetchedAt,
    );
    await tx
      .delete(availabilitySnapshots)
      .where(
        and(
          eq(availabilitySnapshots.courseId, courseId),
          eq(availabilitySnapshots.playDate, playDate),
        ),
      );

    if (teeTimes.length > 0) {
      await tx.insert(availabilitySnapshots).values(
        teeTimes.map((t) => ({
          courseId,
          playDate,
          startTime: t.startTime,
          holes: t.holes,
          layout: t.layout,
          bay: t.bay ?? null,
          durations: t.durations ?? null,
          spotsAvailable: t.spotsAvailable,
          minPlayers: t.minPlayers,
          priceCents: t.priceCents,
          bookingUrl: t.bookingUrl,
          sourceUrl: t.sourceUrl,
          fetchedAt,
        })),
      );
    }

    await tx
      .insert(availabilityChecks)
      .values({
        courseId,
        playDate,
        status: "ok",
        lastAttemptAt: fetchedAt,
        lastSuccessAt: fetchedAt,
        teeTimeCount: teeTimes.length,
        error: null,
      })
      .onConflictDoUpdate({
        target: [availabilityChecks.courseId, availabilityChecks.playDate],
        set: {
          status: "ok",
          lastAttemptAt: fetchedAt,
          lastSuccessAt: fetchedAt,
          teeTimeCount: teeTimes.length,
          error: null,
        },
      });
  });
}

/**
 * Mark dates as failed. Old snapshots are kept, but the search page must
 * treat them as stale and say so rather than show them as current.
 */
export async function recordDayFailures(
  db: Database,
  courseId: string,
  playDates: string[],
  error: string,
  at: Date,
): Promise<void> {
  if (playDates.length === 0) return;
  await db
    .insert(availabilityChecks)
    .values(
      playDates.map((playDate) => ({
        courseId,
        playDate,
        status: "error" as const,
        lastAttemptAt: at,
        error,
      })),
    )
    .onConflictDoUpdate({
      target: [availabilityChecks.courseId, availabilityChecks.playDate],
      set: { status: "error", lastAttemptAt: at, error: sql`excluded.error` },
    });
}

export async function startFetchRun(
  db: Database,
  courseId: string,
  dateFrom: string,
  dateTo: string,
  startedAt: Date,
): Promise<number> {
  const [run] = await db
    .insert(fetchRuns)
    .values({ courseId, dateFrom, dateTo, startedAt })
    .returning({ id: fetchRuns.id });
  return run!.id;
}

export async function finishFetchRun(
  db: Database,
  runId: number,
  result: { status: "ok" | "error"; requestCount: number; teeTimeCount: number; error?: string },
  finishedAt: Date,
): Promise<void> {
  await db
    .update(fetchRuns)
    .set({ ...result, error: result.error ?? null, finishedAt })
    .where(eq(fetchRuns.id, runId));
}

/** Drop snapshots for days that have passed. */
export async function pruneOldSnapshots(
  db: Database,
  beforeDate: string,
  now = new Date(),
): Promise<void> {
  await recordUnbooked(db, sql`s.play_date < ${beforeDate}`, now);
  await db
    .delete(availabilitySnapshots)
    .where(sql`${availabilitySnapshots.playDate} < ${beforeDate}`);
  await db.delete(availabilityChecks).where(sql`${availabilityChecks.playDate} < ${beforeDate}`);
}

export async function snapshotsFor(db: Database, courseIds: string[], playDate: string) {
  return db
    .select()
    .from(availabilitySnapshots)
    .where(
      and(
        inArray(availabilitySnapshots.courseId, courseIds),
        eq(availabilitySnapshots.playDate, playDate),
      ),
    )
    .orderBy(availabilitySnapshots.startTime);
}

/** Record where a course is (from `pnpm courses:locate` or an admin). */
export async function setCourseLocation(
  db: Database,
  courseId: string,
  location: { latitude: number; longitude: number },
): Promise<void> {
  await db
    .update(courses)
    .set({ latitude: location.latitude, longitude: location.longitude, updatedAt: new Date() })
    .where(eq(courses.id, courseId));
}

/** Every course, on or off, with where it is. */
export async function listCourseLocations(db: Database) {
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      name: courses.name,
      suburb: courses.suburb,
      latitude: courses.latitude,
      longitude: courses.longitude,
    })
    .from(courses)
    .orderBy(courses.name);
}
