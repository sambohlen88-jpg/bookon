import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ratingShown } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import { listChangeLog } from "./admin";
import { users } from "./schema";
import {
  listRatingsForAdmin,
  ratingSummaries,
  ratingSummary,
  removeCourseRating,
  removeRatingAsAdmin,
  setCourseRating,
  userCourseRating,
} from "./ratings";
import { seed } from "./seed";
import { listCourseDetails } from "./search";

const now = new Date("2026-10-23T02:00:00Z");
let handle: DbHandle;
let courseId: string;
let other: string;
const golfers: string[] = [];

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const courses = await listCourseDetails(handle.db);
  courseId = courses[0]!.id;
  other = courses[1]!.id;
  for (const email of ["a@example.com", "b@example.com", "c@example.com"])
    golfers.push((await handle.db.insert(users).values({ email }).returning())[0]!.id);
});
afterAll(async () => {
  await handle.close();
});

describe("course ratings", () => {
  it("keeps one rating per golfer per course, which they can change", async () => {
    await setCourseRating(handle.db, golfers[0]!, courseId, 4, now);
    await setCourseRating(handle.db, golfers[0]!, courseId, 2, now);
    expect(await userCourseRating(handle.db, golfers[0]!, courseId)).toBe(2);
    expect(await ratingSummary(handle.db, courseId)).toEqual({ average: 2, count: 1 });
  });

  it("refuses anything but 1 to 5 stars", async () => {
    await expect(setCourseRating(handle.db, golfers[1]!, courseId, 6, now)).rejects.toThrow();
    await expect(setCourseRating(handle.db, golfers[1]!, courseId, 0, now)).rejects.toThrow();
  });

  it("averages across golfers, and only shows from 3 ratings", async () => {
    await setCourseRating(handle.db, golfers[1]!, courseId, 5, now);
    expect(ratingShown(await ratingSummary(handle.db, courseId))).toBe(false);
    await setCourseRating(handle.db, golfers[2]!, courseId, 4, now);
    const summary = await ratingSummary(handle.db, courseId);
    expect(summary).toEqual({ average: 11 / 3, count: 3 });
    expect(ratingShown(summary)).toBe(true);
    await setCourseRating(handle.db, golfers[0]!, other, 3, now);
    const all = await ratingSummaries(handle.db);
    expect(all.get(courseId)?.count).toBe(3);
    expect(all.get(other)).toEqual({ average: 3, count: 1 });
  });

  it("lets a golfer remove their rating", async () => {
    expect(await removeCourseRating(handle.db, golfers[0]!, other)).toBe(true);
    expect(await userCourseRating(handle.db, golfers[0]!, other)).toBeNull();
    expect((await ratingSummaries(handle.db)).has(other)).toBe(false);
  });

  it("lets admin remove a rating, and logs it", async () => {
    const admin = { email: "admin@bookon.test", role: "admin" as const };
    const listed = await listRatingsForAdmin(handle.db);
    expect(listed.map((r) => r.email).sort()).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
    expect(await removeRatingAsAdmin(handle.db, golfers[1]!, courseId, admin, now)).toBe(true);
    expect(await ratingSummary(handle.db, courseId)).toEqual({ average: 3, count: 2 });
    const log = await listChangeLog(handle.db, { courseId });
    expect(log[0]).toMatchObject({ action: "Removed a course rating" });
    expect(await removeRatingAsAdmin(handle.db, golfers[1]!, courseId, admin, now)).toBe(false);
  });
});
