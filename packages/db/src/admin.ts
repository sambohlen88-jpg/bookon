import { and, asc, count, desc, eq, gt, inArray, isNull, max, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  applicationDetails,
  listApplicationRates,
  photoInfo,
  type ClubApplication,
  type ClubApplicationDetails,
  type ClubPhotoInfo,
  type ClubRate,
  type RateInput,
} from "./clubs";
import {
  availabilityChecks,
  changeLog,
  changeRequests,
  clubApplications,
  clubMembers,
  clubPhotos,
  clubRates,
  clubs,
  courses,
  fetchRuns,
} from "./schema";
import { checkProblem, type CheckProblem } from "./search";

/* Admin area and club logins (Milestone 8). */

export type Club = typeof clubs.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type ClubMember = typeof clubMembers.$inferSelect;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type ChangeLogEntry = typeof changeLog.$inferSelect;
export type ClubRole = ClubMember["role"];

/** Photos a club can have from its login (approved or waiting). */
export const MAX_CLUB_LOGIN_PHOTOS = 20;

/**
 * Platforms BookOn has a reader for and the owner has approved
 * (docs/platforms.md). A course on any other platform can be listed but not
 * switched on.
 */
export const READABLE_PLATFORMS = ["miclub", "quick18"] as const;

export interface Actor {
  email: string;
  role: "admin" | "club";
}

/** Record who changed what. Never throws: a failed log line mustn't undo the change. */
export async function logChange(
  db: Database,
  actor: Actor,
  entry: {
    action: string;
    clubId?: string | null;
    courseId?: string | null;
    details?: Record<string, unknown>;
  },
  now = new Date(),
): Promise<void> {
  try {
    await db.insert(changeLog).values({
      at: now,
      actor: actor.email,
      actorRole: actor.role,
      clubId: entry.clubId ?? null,
      courseId: entry.courseId ?? null,
      action: entry.action,
      details: entry.details ?? {},
    });
  } catch (error) {
    console.error("[admin] could not write change log", error);
  }
}

export async function listChangeLog(
  db: Database,
  options: { clubId?: string; courseId?: string; limit?: number } = {},
): Promise<(ChangeLogEntry & { clubName: string | null; courseName: string | null })[]> {
  const rows = await db
    .select({
      entry: changeLog,
      clubName: clubs.name,
      courseName: courses.name,
    })
    .from(changeLog)
    .leftJoin(clubs, eq(clubs.id, changeLog.clubId))
    .leftJoin(courses, eq(courses.id, changeLog.courseId))
    .where(
      and(
        options.clubId ? eq(changeLog.clubId, options.clubId) : undefined,
        options.courseId ? eq(changeLog.courseId, options.courseId) : undefined,
      ),
    )
    .orderBy(desc(changeLog.at), desc(changeLog.id))
    .limit(options.limit ?? 100);
  return rows.map((r) => ({ ...r.entry, clubName: r.clubName, courseName: r.courseName }));
}

/* Clubs */

export function clubProfile(club: Club): ClubApplicationDetails {
  return club.profile as ClubApplicationDetails;
}

export async function clubById(db: Database, id: string): Promise<Club | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
  return club ?? null;
}

export async function listClubs(
  db: Database,
): Promise<(Club & { courseCount: number; memberCount: number })[]> {
  const rows = await db.select().from(clubs).orderBy(asc(clubs.name));
  const courseCounts = await db
    .select({ clubId: courses.clubId, n: count() })
    .from(courses)
    .groupBy(courses.clubId);
  const memberCounts = await db
    .select({ clubId: clubMembers.clubId, n: count() })
    .from(clubMembers)
    .groupBy(clubMembers.clubId);
  return rows.map((c) => ({
    ...c,
    courseCount: courseCounts.find((r) => r.clubId === c.id)?.n ?? 0,
    memberCount: memberCounts.find((r) => r.clubId === c.id)?.n ?? 0,
  }));
}

export async function coursesForClub(db: Database, clubId: string): Promise<Course[]> {
  return db.select().from(courses).where(eq(courses.clubId, clubId)).orderBy(asc(courses.name));
}

/** Save part of a club's profile, recording who did it. */
export async function updateClubProfile(
  db: Database,
  club: Club,
  patch: ClubApplicationDetails,
  actor: Actor,
  now: Date,
): Promise<void> {
  const profile = { ...clubProfile(club), ...patch };
  await db
    .update(clubs)
    .set({
      profile: profile as Record<string, unknown>,
      name: profile.club?.name || club.name,
      contactEmail: profile.contacts?.main.email || club.contactEmail,
      updatedAt: now,
    })
    .where(eq(clubs.id, club.id));
  await logChange(
    db,
    actor,
    { action: "Updated club details", clubId: club.id, details: { sections: Object.keys(patch) } },
    now,
  );
}

/* Members */

export async function listClubMembers(db: Database, clubId: string): Promise<ClubMember[]> {
  return db
    .select()
    .from(clubMembers)
    .where(eq(clubMembers.clubId, clubId))
    .orderBy(asc(clubMembers.role), asc(clubMembers.email));
}

/** The clubs an email address can manage, with its role at each. */
export async function clubsForEmail(
  db: Database,
  email: string,
): Promise<(Club & { role: ClubRole })[]> {
  const rows = await db
    .select({ club: clubs, role: clubMembers.role })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(eq(clubMembers.email, email.toLowerCase()))
    .orderBy(asc(clubs.name));
  return rows.map((r) => ({ ...r.club, role: r.role }));
}

export async function clubRole(
  db: Database,
  clubId: string,
  email: string,
): Promise<ClubRole | null> {
  const [row] = await db
    .select({ role: clubMembers.role })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.email, email.toLowerCase())));
  return row?.role ?? null;
}

/** Add someone to a club's login, or change their role. */
export async function addClubMember(
  db: Database,
  clubId: string,
  email: string,
  role: ClubRole,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(clubMembers)
    .values({ clubId, email: email.toLowerCase(), role, addedBy: actor.email, createdAt: now })
    .onConflictDoUpdate({ target: [clubMembers.clubId, clubMembers.email], set: { role } });
  await logChange(db, actor, { action: `Added ${email} as ${role}`, clubId }, now);
}

/** Remove someone. A club always keeps at least one owner. */
export async function removeClubMember(
  db: Database,
  clubId: string,
  email: string,
  actor: Actor,
  now: Date,
): Promise<{ ok: true } | { error: "last-owner" }> {
  const members = await listClubMembers(db, clubId);
  const target = members.find((m) => m.email === email.toLowerCase());
  if (!target) return { ok: true };
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length === 1) {
    return { error: "last-owner" };
  }
  await db
    .delete(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.email, target.email)));
  await logChange(db, actor, { action: `Removed ${target.email}`, clubId }, now);
  return { ok: true };
}

/* Approving a listing */

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "club"
  );
}

async function freeSlug(
  db: Database,
  table: typeof clubs | typeof courses,
  base: string,
): Promise<string> {
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [taken] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug));
    if (!taken) return slug;
  }
}

const PLATFORM_FOR_SYSTEM: Record<string, Course["platform"]> = {
  miclub: "miclub",
  quick18: "quick18",
  chronogolf: "chronogolf",
};

/**
 * Approve a listing: creates the club and its courses (switched off until
 * their booking page is set up and tested), copies the price list and
 * photos across, and makes the main contact the club's owner login.
 */
export async function approveClubApplication(
  db: Database,
  application: ClubApplication,
  actor: Actor,
  note: string | null,
  now: Date,
): Promise<{ clubId: string; courseIds: string[] } | { error: "not-submitted" }> {
  if (application.status !== "submitted") return { error: "not-submitted" };
  const details = applicationDetails(application);
  const rates = await listApplicationRates(db, application.id);
  const clubSlug = await freeSlug(db, clubs, slugify(details.club?.name ?? application.clubName));
  const courseSlugs: string[] = [];
  for (const c of details.courses ?? []) {
    let slug = await freeSlug(db, courses, slugify(c.name));
    while (courseSlugs.includes(slug)) slug = `${slug}-x`;
    courseSlugs.push(slug);
  }

  return db.transaction(async (tx) => {
    const [club] = await tx
      .insert(clubs)
      .values({
        name: details.club?.name ?? application.clubName,
        slug: clubSlug,
        contactEmail: application.contactEmail,
        profile: details as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const website = details.club?.website ?? details.teeTimes?.bookingUrl ?? "";
    const courseRows =
      (details.courses ?? []).length === 0
        ? []
        : await tx
            .insert(courses)
            .values(
              (details.courses ?? []).map((c, i) => ({
                clubId: club!.id,
                name: c.name,
                slug: courseSlugs[i]!,
                suburb: details.club?.suburb ?? "",
                holes: c.holes,
                platform: PLATFORM_FOR_SYSTEM[details.teeTimes?.bookingSystem ?? ""] ?? "manual",
                websiteUrl: website,
                bookingUrl: details.teeTimes?.bookingUrl ?? website,
                bookingWindowDays: Math.min(Math.max(details.teeTimes?.windowDays ?? 7, 1), 60),
                enabled: false,
                notes: `From club listing ${application.id}`,
                createdAt: now,
                updatedAt: now,
              })),
            )
            .returning({ id: courses.id });
    if (rates.length > 0) {
      await tx.insert(clubRates).values(
        rates.map((r) => {
          const { id: _id, applicationId: _app, clubId: _club, ...rest } = r;
          return { ...rest, clubId: club!.id, applicationId: null };
        }),
      );
    }
    await tx
      .update(clubPhotos)
      .set({ clubId: club!.id })
      .where(eq(clubPhotos.applicationId, application.id));
    await tx
      .insert(clubMembers)
      .values({
        clubId: club!.id,
        email: application.contactEmail.toLowerCase(),
        role: "owner",
        addedBy: actor.email,
        createdAt: now,
      })
      .onConflictDoNothing();
    await tx
      .update(clubApplications)
      .set({ status: "approved", clubId: club!.id, reviewNotes: note, updatedAt: now })
      .where(eq(clubApplications.id, application.id));
    await tx.insert(changeLog).values({
      at: now,
      actor: actor.email,
      actorRole: actor.role,
      clubId: club!.id,
      action: "Approved club listing",
      details: { applicationId: application.id, note },
    });
    return { clubId: club!.id, courseIds: courseRows.map((c) => c.id) };
  });
}

export async function declineClubApplication(
  db: Database,
  application: ClubApplication,
  actor: Actor,
  note: string | null,
  now: Date,
): Promise<void> {
  await db
    .update(clubApplications)
    .set({ status: "declined", reviewNotes: note, updatedAt: now })
    .where(eq(clubApplications.id, application.id));
  await logChange(
    db,
    actor,
    {
      action: `Declined club listing from ${application.clubName}`,
      details: { applicationId: application.id, note },
    },
    now,
  );
}

/* A club's price list, once live */

export async function listClubRates(db: Database, clubId: string): Promise<ClubRate[]> {
  return db
    .select()
    .from(clubRates)
    .where(and(eq(clubRates.clubId, clubId), isNull(clubRates.applicationId)))
    .orderBy(asc(clubRates.sort));
}

export async function replaceClubRates(
  db: Database,
  clubId: string,
  rates: RateInput[],
  actor: Actor,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(clubRates)
      .where(and(eq(clubRates.clubId, clubId), isNull(clubRates.applicationId)));
    if (rates.length > 0) {
      await tx
        .insert(clubRates)
        .values(rates.map((r, i) => ({ ...r, clubId, applicationId: null, sort: i })));
    }
  });
  await logChange(
    db,
    actor,
    { action: "Updated price list", clubId, details: { lines: rates.length } },
    now,
  );
}

/* Courses */

export interface CourseHealth {
  lastSuccessAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: "ok" | "error" | null;
  lastError: string | null;
  problem: CheckProblem | null;
  /** Failed runs in the last 24 hours. */
  failures24h: number;
  runs24h: number;
}

export type AdminCourse = Course & { clubName: string; health: CourseHealth };

/** Every course, switched on or off, with how its checks are going. */
export async function listCoursesForAdmin(db: Database, now: Date): Promise<AdminCourse[]> {
  const rows = await db
    .select({ course: courses, clubName: clubs.name })
    .from(courses)
    .innerJoin(clubs, eq(clubs.id, courses.clubId))
    .orderBy(asc(courses.name));
  const lastSuccess = await db
    .select({ courseId: availabilityChecks.courseId, at: max(availabilityChecks.lastSuccessAt) })
    .from(availabilityChecks)
    .groupBy(availabilityChecks.courseId);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select({
      courseId: fetchRuns.courseId,
      runs: count(),
      failures: sql<number>`count(*) filter (where ${fetchRuns.status} = 'error')`.mapWith(Number),
    })
    .from(fetchRuns)
    .where(gt(fetchRuns.startedAt, since))
    .groupBy(fetchRuns.courseId);
  // The latest finished run per course.
  const latest = await db
    .selectDistinctOn([fetchRuns.courseId], {
      courseId: fetchRuns.courseId,
      at: fetchRuns.finishedAt,
      status: fetchRuns.status,
      error: fetchRuns.error,
    })
    .from(fetchRuns)
    .where(sql`${fetchRuns.finishedAt} is not null`)
    .orderBy(fetchRuns.courseId, desc(fetchRuns.startedAt));

  return rows.map(({ course, clubName }) => {
    const run = latest.find((r) => r.courseId === course.id);
    const counts = recent.find((r) => r.courseId === course.id);
    const success = lastSuccess.find((r) => r.courseId === course.id)?.at ?? null;
    return {
      ...course,
      clubName,
      health: {
        lastSuccessAt: success ? new Date(success) : null,
        lastRunAt: run?.at ?? null,
        lastRunStatus: run?.status ?? null,
        lastError: run?.status === "error" ? (run.error ?? null) : null,
        problem: run?.status === "error" ? checkProblem(run.error ?? null) : null,
        failures24h: counts?.failures ?? 0,
        runs24h: counts?.runs ?? 0,
      },
    };
  });
}

/** A course's latest worker runs, newest first. */
export async function listFetchRuns(db: Database, courseId: string, limit = 20) {
  return db
    .select()
    .from(fetchRuns)
    .where(eq(fetchRuns.courseId, courseId))
    .orderBy(desc(fetchRuns.startedAt))
    .limit(limit);
}

export async function courseBySlugForAdmin(db: Database, slug: string): Promise<Course | null> {
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug));
  return course ?? null;
}

export interface CourseEdit {
  name: string;
  suburb: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  holes: number;
  websiteUrl: string;
  bookingUrl: string;
  bookingWindowDays: number;
  typicalGreenFeeCents: number | null;
  notes: string | null;
  platform: Course["platform"];
  platformConfig: Record<string, unknown>;
}

/** Edit a course, recording which fields changed. */
export async function updateCourse(
  db: Database,
  course: Course,
  edit: CourseEdit,
  actor: Actor,
  now: Date,
): Promise<void> {
  const changed = (Object.keys(edit) as (keyof CourseEdit)[]).filter(
    (k) => JSON.stringify(edit[k]) !== JSON.stringify(course[k]),
  );
  if (changed.length === 0) return;
  await db
    .update(courses)
    .set({ ...edit, updatedAt: now })
    .where(eq(courses.id, course.id));
  await logChange(
    db,
    actor,
    {
      action: "Edited course",
      clubId: course.clubId,
      courseId: course.id,
      details: Object.fromEntries(changed.map((k) => [k, { from: course[k], to: edit[k] }])),
    },
    now,
  );
}

/** Whether the worker has ever read this course's booking page successfully. */
export async function hasSuccessfulCheck(db: Database, courseId: string): Promise<boolean> {
  const [row] = await db
    .select({ at: max(availabilityChecks.lastSuccessAt) })
    .from(availabilityChecks)
    .where(eq(availabilityChecks.courseId, courseId));
  return Boolean(row?.at);
}

/** Why a course can't be switched on, or null when it can. */
export function cannotSwitchOn(course: Course, checkedOk = true): string | null {
  if (!(READABLE_PLATFORMS as readonly string[]).includes(course.platform)) {
    return course.platform === "chronogolf"
      ? "BookOn can't read Chronogolf booking pages yet."
      : "BookOn can only read MiClub and Quick18 booking pages.";
  }
  if (Object.keys(course.platformConfig).length === 0) {
    return "Fill in the booking system settings first, then test the course with the worker.";
  }
  if (!checkedOk) {
    return `Test the course with the worker first, so we know BookOn can read its booking page: pnpm --filter @bookon/worker poll -- --course ${course.slug} --days 2`;
  }
  return null;
}

export async function setCourseEnabled(
  db: Database,
  course: Course,
  enabled: boolean,
  actor: Actor,
  now: Date,
): Promise<{ ok: true } | { error: string }> {
  if (enabled) {
    const reason = cannotSwitchOn(course, await hasSuccessfulCheck(db, course.id));
    if (reason) return { error: reason };
  }
  await db.update(courses).set({ enabled, updatedAt: now }).where(eq(courses.id, course.id));
  await logChange(
    db,
    actor,
    {
      action: enabled ? "Switched course on" : "Switched course off",
      clubId: course.clubId,
      courseId: course.id,
    },
    now,
  );
  return { ok: true };
}

/* Change requests */

/** A club asks for a change BookOn checks first. One pending request per kind and course. */
export async function requestChange(
  db: Database,
  input: {
    clubId: string;
    courseId: string | null;
    kind: "booking_url";
    value: string;
    requestedBy: string;
  },
  now: Date,
): Promise<void> {
  await db
    .delete(changeRequests)
    .where(
      and(
        eq(changeRequests.clubId, input.clubId),
        eq(changeRequests.kind, input.kind),
        eq(changeRequests.status, "pending"),
        input.courseId
          ? eq(changeRequests.courseId, input.courseId)
          : isNull(changeRequests.courseId),
      ),
    );
  await db.insert(changeRequests).values({ ...input, createdAt: now });
  await logChange(
    db,
    { email: input.requestedBy, role: "club" },
    {
      action: "Asked to change the booking page",
      clubId: input.clubId,
      courseId: input.courseId,
      details: { value: input.value },
    },
    now,
  );
}

export async function listChangeRequests(
  db: Database,
  filter: { status?: ChangeRequest["status"]; clubId?: string } = {},
): Promise<(ChangeRequest & { clubName: string; courseName: string | null })[]> {
  const rows = await db
    .select({ request: changeRequests, clubName: clubs.name, courseName: courses.name })
    .from(changeRequests)
    .innerJoin(clubs, eq(clubs.id, changeRequests.clubId))
    .leftJoin(courses, eq(courses.id, changeRequests.courseId))
    .where(
      and(
        filter.status ? eq(changeRequests.status, filter.status) : undefined,
        filter.clubId ? eq(changeRequests.clubId, filter.clubId) : undefined,
      ),
    )
    .orderBy(desc(changeRequests.createdAt));
  return rows.map((r) => ({ ...r.request, clubName: r.clubName, courseName: r.courseName }));
}

/** Approve (and apply) or decline a change request. */
export async function decideChangeRequest(
  db: Database,
  id: string,
  approve: boolean,
  actor: Actor,
  now: Date,
): Promise<void> {
  const [request] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
  if (!request || request.status !== "pending") return;
  if (approve && request.kind === "booking_url") {
    await db
      .update(courses)
      .set({ bookingUrl: request.value, updatedAt: now })
      .where(
        request.courseId ? eq(courses.id, request.courseId) : eq(courses.clubId, request.clubId),
      );
  }
  await db
    .update(changeRequests)
    .set({ status: approve ? "approved" : "declined", decidedBy: actor.email, decidedAt: now })
    .where(eq(changeRequests.id, id));
  await logChange(
    db,
    actor,
    {
      action: approve ? "Approved booking page change" : "Declined booking page change",
      clubId: request.clubId,
      courseId: request.courseId,
      details: { value: request.value },
    },
    now,
  );
}

/* Photos */

export type PhotoForReview = ClubPhotoInfo & {
  clubName: string | null;
  fromListing: string | null;
};

/** Photos waiting for a decision, with where they came from. */
export async function listPendingPhotos(db: Database): Promise<PhotoForReview[]> {
  const rows = await db
    .select({ photo: photoInfo, clubName: clubs.name, fromListing: clubApplications.clubName })
    .from(clubPhotos)
    .leftJoin(clubs, eq(clubs.id, clubPhotos.clubId))
    .leftJoin(clubApplications, eq(clubApplications.id, clubPhotos.applicationId))
    .where(eq(clubPhotos.status, "pending"))
    .orderBy(asc(clubPhotos.createdAt));
  return rows.map((r) => ({ ...r.photo, clubName: r.clubName, fromListing: r.fromListing }));
}

export async function listPhotosForClub(db: Database, clubId: string): Promise<ClubPhotoInfo[]> {
  return db
    .select(photoInfo)
    .from(clubPhotos)
    .where(eq(clubPhotos.clubId, clubId))
    .orderBy(asc(clubPhotos.createdAt));
}

export async function addPhotoForClub(
  db: Database,
  clubId: string,
  photo: {
    contentType: string;
    width: number;
    height: number;
    data: Buffer;
    caption?: string | null;
    credit?: string | null;
    rightsConfirmedBy: string;
  },
  actor: Actor,
  now: Date,
): Promise<{ id: string } | { error: "limit" }> {
  const [existing] = await db
    .select({ n: count() })
    .from(clubPhotos)
    .where(and(eq(clubPhotos.clubId, clubId), inArray(clubPhotos.status, ["pending", "approved"])));
  if ((existing?.n ?? 0) >= MAX_CLUB_LOGIN_PHOTOS) return { error: "limit" };
  const [row] = await db
    .insert(clubPhotos)
    .values({
      clubId,
      createdAt: now,
      contentType: photo.contentType,
      width: photo.width,
      height: photo.height,
      data: photo.data,
      caption: photo.caption?.slice(0, 200) ?? null,
      credit: photo.credit?.slice(0, 120) ?? null,
      rightsConfirmedBy: photo.rightsConfirmedBy.slice(0, 120),
    })
    .returning({ id: clubPhotos.id });
  await logChange(db, actor, { action: "Uploaded a photo", clubId }, now);
  return { id: row!.id };
}

/** A club removes one of its photos. */
export async function removePhotoForClub(
  db: Database,
  clubId: string,
  photoId: string,
  actor: Actor,
  now: Date,
): Promise<void> {
  const removed = await db
    .delete(clubPhotos)
    .where(and(eq(clubPhotos.id, photoId), eq(clubPhotos.clubId, clubId)))
    .returning({ id: clubPhotos.id });
  if (removed.length > 0) await logChange(db, actor, { action: "Removed a photo", clubId }, now);
}

/* Overview */

export async function adminCounts(db: Database) {
  const [listings] = await db
    .select({ n: count() })
    .from(clubApplications)
    .where(eq(clubApplications.status, "submitted"));
  const [photos] = await db
    .select({ n: count() })
    .from(clubPhotos)
    .where(eq(clubPhotos.status, "pending"));
  const [requests] = await db
    .select({ n: count() })
    .from(changeRequests)
    .where(eq(changeRequests.status, "pending"));
  return {
    listings: listings?.n ?? 0,
    photos: photos?.n ?? 0,
    changeRequests: requests?.n ?? 0,
  };
}

/** What golfers see about a course's club: its details and current prices, from the club's login. */
export async function coursePublicInfo(
  db: Database,
  courseId: string,
  today: string,
): Promise<{ profile: ClubApplicationDetails; rates: ClubRate[] }> {
  const [row] = await db
    .select({ club: clubs, courseName: courses.name })
    .from(courses)
    .innerJoin(clubs, eq(clubs.id, courses.clubId))
    .where(eq(courses.id, courseId));
  if (!row) return { profile: {}, rates: [] };
  const rates = (await listClubRates(db, row.club.id)).filter(
    (r) =>
      r.category !== "membership" &&
      (!r.courseName || r.courseName === row.courseName) &&
      (!r.validTo || r.validTo >= today),
  );
  return { profile: clubProfile(row.club), rates };
}
