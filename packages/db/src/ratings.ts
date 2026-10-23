import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { validStars, type RatingSummary } from "@bookon/core";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import { courseRatings, courses, users } from "./schema";

/** Course ratings (Milestone 20): one rating per golfer per course, which they can change or remove. */

export async function setCourseRating(
  db: Database,
  userId: string,
  courseId: string,
  stars: number,
  now: Date,
): Promise<void> {
  if (!validStars(stars)) throw new Error("A rating is 1 to 5 stars");
  await db
    .insert(courseRatings)
    .values({ userId, courseId, stars, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { stars, updatedAt: now },
    });
}

export async function removeCourseRating(
  db: Database,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const rows = await db
    .delete(courseRatings)
    .where(and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)))
    .returning({ stars: courseRatings.stars });
  return rows.length > 0;
}

/** The golfer's own rating of a course, if they've rated it. */
export async function userCourseRating(
  db: Database,
  userId: string,
  courseId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ stars: courseRatings.stars })
    .from(courseRatings)
    .where(and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)));
  return row?.stars ?? null;
}

/** Every rated course's average and count, by course id. Courses with no ratings are left out. */
export async function ratingSummaries(db: Database): Promise<Map<string, RatingSummary>> {
  const rows = await db
    .select({
      courseId: courseRatings.courseId,
      average: avg(courseRatings.stars),
      count: count(),
    })
    .from(courseRatings)
    .groupBy(courseRatings.courseId);
  return new Map(
    rows.map((r) => [r.courseId, { average: Number(r.average), count: Number(r.count) }]),
  );
}

export async function ratingSummary(db: Database, courseId: string): Promise<RatingSummary> {
  const [row] = await db
    .select({ average: avg(courseRatings.stars), count: count() })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId));
  return { average: Number(row?.average ?? 0), count: Number(row?.count ?? 0) };
}

/** Ratings for admin, newest first, with who gave them. */
export async function listRatingsForAdmin(db: Database, limit = 300) {
  return db
    .select({
      userId: courseRatings.userId,
      courseId: courseRatings.courseId,
      stars: courseRatings.stars,
      updatedAt: courseRatings.updatedAt,
      email: users.email,
      courseName: courses.name,
      courseSlug: courses.slug,
    })
    .from(courseRatings)
    .innerJoin(users, eq(users.id, courseRatings.userId))
    .innerJoin(courses, eq(courses.id, courseRatings.courseId))
    .orderBy(desc(courseRatings.updatedAt), sql`${courses.name}`)
    .limit(limit);
}

/** Admin takes down a rating that looks like spam or a grudge. Logged. */
export async function removeRatingAsAdmin(
  db: Database,
  userId: string,
  courseId: string,
  actor: Actor,
  now: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ stars: courseRatings.stars, email: users.email })
    .from(courseRatings)
    .innerJoin(users, eq(users.id, courseRatings.userId))
    .where(and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)));
  if (!row) return false;
  await removeCourseRating(db, userId, courseId);
  await logChange(
    db,
    actor,
    {
      action: "Removed a course rating",
      courseId,
      details: { stars: row.stars, by: row.email },
    },
    now,
  );
  return true;
}
