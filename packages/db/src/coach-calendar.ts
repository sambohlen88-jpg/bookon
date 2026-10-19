import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, lt } from "drizzle-orm";
import type { Database } from "./client";
import type { Coach } from "./coaches";
import type { LessonBooking } from "./lessons";
import { coachBusy, coaches, lessonBookings } from "./schema";

/**
 * Coach calendars (Milestone 16): times blocked out on BookOn, busy times
 * read from the coach's own calendar, and the private link their calendar
 * app subscribes to.
 */

export type CoachBusy = typeof coachBusy.$inferSelect;

/** Longest single block, so a typo can't close a coach for a year. */
const MAX_BLOCK_DAYS = 31;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The coach's calendar link token, made the first time it's needed. */
export async function coachCalendarToken(db: Database, coach: Coach, now: Date): Promise<string> {
  if (coach.calendarToken) return coach.calendarToken;
  const token = newToken();
  await db
    .update(coaches)
    .set({ calendarToken: token, updatedAt: now })
    .where(eq(coaches.id, coach.id));
  return token;
}

/** A new link, so the old one (say, if it was shared by mistake) stops working. */
export async function resetCoachCalendarToken(
  db: Database,
  coachId: string,
  now: Date,
): Promise<string> {
  const token = newToken();
  await db
    .update(coaches)
    .set({ calendarToken: token, updatedAt: now })
    .where(eq(coaches.id, coachId));
  return token;
}

export async function coachByCalendarToken(db: Database, token: string): Promise<Coach | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(coaches).where(eq(coaches.calendarToken, token));
  return row ?? null;
}

export class BlockProblem extends Error {}

export async function addCoachBlock(
  db: Database,
  coachId: string,
  input: { start: Date; end: Date; note?: string | null },
  now: Date,
): Promise<CoachBusy> {
  if (!(input.end > input.start)) throw new BlockProblem("The end needs to be after the start.");
  if (input.end <= now) throw new BlockProblem("That time has already passed.");
  if (input.end.getTime() - input.start.getTime() > MAX_BLOCK_DAYS * 24 * 60 * 60 * 1000)
    throw new BlockProblem(
      "Block out at most a month at a time, or add days away to your listing.",
    );
  const [row] = await db
    .insert(coachBusy)
    .values({
      coachId,
      source: "block",
      startTime: input.start,
      endTime: input.end,
      note: input.note?.trim().slice(0, 120) || null,
      createdAt: now,
    })
    .returning();
  return row!;
}

/** Only the coach's own blocks can be removed; calendar times come and go with their calendar. */
export async function removeCoachBlock(
  db: Database,
  coachId: string,
  id: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await db
    .delete(coachBusy)
    .where(and(eq(coachBusy.id, id), eq(coachBusy.coachId, coachId), eq(coachBusy.source, "block")))
    .returning({ id: coachBusy.id });
  return rows.length > 0;
}

/** Save (or with null, remove) the coach's own calendar link. Removing it clears its busy times. */
export async function setBusyCalendarUrl(
  db: Database,
  coachId: string,
  url: string | null,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(coaches)
      .set({
        busyCalendarUrl: url,
        busyCalendarReadAt: null,
        busyCalendarError: null,
        updatedAt: now,
      })
      .where(eq(coaches.id, coachId));
    await tx
      .delete(coachBusy)
      .where(and(eq(coachBusy.coachId, coachId), eq(coachBusy.source, "calendar")));
  });
}

/** Replace the busy times from the coach's calendar with a fresh read. */
export async function saveBusyCalendarRead(
  db: Database,
  coachId: string,
  busy: { start: Date; end: Date }[],
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(coachBusy)
      .where(and(eq(coachBusy.coachId, coachId), eq(coachBusy.source, "calendar")));
    if (busy.length > 0) {
      await tx.insert(coachBusy).values(
        busy.map((b) => ({
          coachId,
          source: "calendar",
          startTime: b.start,
          endTime: b.end,
          createdAt: now,
        })),
      );
    }
    await tx
      .update(coaches)
      .set({ busyCalendarReadAt: now, busyCalendarError: null })
      .where(eq(coaches.id, coachId));
  });
}

/**
 * The read failed. The busy times from the last good read stay, so a
 * calendar that's briefly down doesn't open up times the coach is busy.
 */
export async function saveBusyCalendarError(
  db: Database,
  coachId: string,
  message: string,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({ busyCalendarReadAt: now, busyCalendarError: message.slice(0, 300) })
    .where(eq(coaches.id, coachId));
}

export async function coachesWithBusyCalendars(db: Database) {
  return db
    .select({
      id: coaches.id,
      url: coaches.busyCalendarUrl,
      readAt: coaches.busyCalendarReadAt,
    })
    .from(coaches)
    .where(and(isNotNull(coaches.busyCalendarUrl), eq(coaches.status, "live")));
}

export interface CoachCalendar {
  lessons: LessonBooking[];
  busy: CoachBusy[];
}

/** Everything on a coach's calendar between two instants: lessons booked or waiting, blocks and busy times. */
export async function coachCalendar(
  db: Database,
  coachId: string,
  from: Date,
  to: Date,
): Promise<CoachCalendar> {
  const lessons = await db
    .select()
    .from(lessonBookings)
    .where(
      and(
        eq(lessonBookings.coachId, coachId),
        inArray(lessonBookings.status, ["requested", "confirmed"]),
        lt(lessonBookings.startTime, to),
        gt(lessonBookings.endTime, from),
      ),
    )
    .orderBy(asc(lessonBookings.startTime));
  const busy = await db
    .select()
    .from(coachBusy)
    .where(
      and(eq(coachBusy.coachId, coachId), lt(coachBusy.startTime, to), gt(coachBusy.endTime, from)),
    )
    .orderBy(asc(coachBusy.startTime));
  return { lessons, busy };
}
