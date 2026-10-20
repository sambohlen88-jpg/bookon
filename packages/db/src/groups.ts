import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { CHECKOUT_MINUTES, MINIMUM_CHECK_HOURS, type TakenTime } from "@bookon/core";
import type { Database } from "./client";
import { coachBusy, coaches, groupBookings, groupSessions, lessonBookings } from "./schema";

/**
 * Group sessions (Milestone 19). Like lessons, these functions only move a
 * booking or session from the state they expect; @bookon/payments moves the
 * money first and then calls them.
 */

export type GroupSession = typeof groupSessions.$inferSelect;
export type GroupBooking = typeof groupBookings.$inferSelect;
export type GroupBookingStatus = GroupBooking["status"];

export interface NewGroupSessions {
  coachId: string;
  title: string;
  details?: string | null;
  /** One start per week when it repeats. */
  starts: Date[];
  minutes: number;
  place: string;
  priceCents: number;
  spots: number;
  minSpots?: number | null;
}

/** Some of the times clash with a lesson, a blocked-out time or another session. */
export class GroupSessionClash extends Error {
  constructor(readonly starts: Date[]) {
    super("That time clashes with something already booked");
  }
}

/** Open sessions a coach runs, as times golfers can't book a lesson. */
export async function groupSessionTimes(
  db: Database,
  coachId: string,
  now: Date,
): Promise<TakenTime[]> {
  return db
    .select({ start: groupSessions.startTime, end: groupSessions.endTime })
    .from(groupSessions)
    .where(
      and(
        eq(groupSessions.coachId, coachId),
        eq(groupSessions.status, "open"),
        gt(groupSessions.endTime, now),
      ),
    );
}

/**
 * Put on a session, or one each week. Refuses all of them if any clash with
 * a lesson held or booked, a time the coach blocked out, or another session.
 * Busy times read from the coach's own calendar don't count, as the session
 * itself is often already there.
 */
export async function createGroupSessions(
  db: Database,
  input: NewGroupSessions,
  now: Date,
): Promise<GroupSession[]> {
  const seriesId = input.starts.length > 1 ? randomUUID() : null;
  const times = input.starts.map((start) => ({
    start,
    end: new Date(start.getTime() + input.minutes * 60_000),
  }));
  return db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await tx
      .select({ id: coaches.id })
      .from(coaches)
      .where(eq(coaches.id, input.coachId))
      .for("update");
    const lessons = await t
      .select({ start: lessonBookings.startTime, end: lessonBookings.endTime })
      .from(lessonBookings)
      .where(
        and(
          eq(lessonBookings.coachId, input.coachId),
          gt(lessonBookings.endTime, now),
          or(
            inArray(lessonBookings.status, ["requested", "confirmed"]),
            and(eq(lessonBookings.status, "checkout"), gt(lessonBookings.checkoutExpiresAt, now)),
          ),
        ),
      );
    const blocks = await t
      .select({ start: coachBusy.startTime, end: coachBusy.endTime })
      .from(coachBusy)
      .where(
        and(
          eq(coachBusy.coachId, input.coachId),
          eq(coachBusy.source, "block"),
          gt(coachBusy.endTime, now),
        ),
      );
    const sessions = await groupSessionTimes(t, input.coachId, now);
    const taken = [...lessons, ...blocks, ...sessions];
    const clashes = times.filter((w) => taken.some((b) => b.start < w.end && w.start < b.end));
    if (clashes.length > 0) throw new GroupSessionClash(clashes.map((c) => c.start));
    return tx
      .insert(groupSessions)
      .values(
        times.map((w) => ({
          coachId: input.coachId,
          seriesId,
          title: input.title,
          details: input.details || null,
          startTime: w.start,
          endTime: w.end,
          place: input.place,
          priceCents: input.priceCents,
          spots: input.spots,
          minSpots: input.minSpots ?? null,
          createdAt: now,
        })),
      )
      .returning();
  });
}

export async function groupSessionById(db: Database, id: string): Promise<GroupSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(groupSessions).where(eq(groupSessions.id, id));
  return row ?? null;
}

/** Spots paid for, or held at checkout, on each session. */
export async function spotsTaken(
  db: Database,
  sessionIds: string[],
  now: Date,
): Promise<Map<string, number>> {
  const taken = new Map<string, number>(sessionIds.map((id) => [id, 0]));
  if (sessionIds.length === 0) return taken;
  const rows = await db
    .select({
      sessionId: groupBookings.sessionId,
      spots: sql<number>`sum(${groupBookings.spots})::int`,
    })
    .from(groupBookings)
    .where(
      and(
        inArray(groupBookings.sessionId, sessionIds),
        or(
          eq(groupBookings.status, "paid"),
          and(eq(groupBookings.status, "checkout"), gt(groupBookings.checkoutExpiresAt, now)),
        ),
      ),
    )
    .groupBy(groupBookings.sessionId);
  for (const r of rows) taken.set(r.sessionId, Number(r.spots));
  return taken;
}

/** Spots paid for on a session, leaving out checkouts. */
export async function paidSpots(db: Database, sessionId: string): Promise<number> {
  const [row] = await db
    .select({ spots: sql<number>`coalesce(sum(${groupBookings.spots}), 0)::int` })
    .from(groupBookings)
    .where(and(eq(groupBookings.sessionId, sessionId), eq(groupBookings.status, "paid")));
  return Number(row?.spots ?? 0);
}

export interface SessionWithSpots extends GroupSession {
  /** Paid or held at checkout. */
  taken: number;
  left: number;
}

async function withSpots(
  db: Database,
  sessions: GroupSession[],
  now: Date,
): Promise<SessionWithSpots[]> {
  const taken = await spotsTaken(
    db,
    sessions.map((s) => s.id),
    now,
  );
  return sessions.map((s) => {
    const n = taken.get(s.id) ?? 0;
    return { ...s, taken: n, left: Math.max(0, s.spots - n) };
  });
}

/** Sessions golfers can still book, soonest first. All coaches, or just these. */
export async function upcomingGroupSessions(
  db: Database,
  now: Date,
  coachIds?: string[],
): Promise<SessionWithSpots[]> {
  if (coachIds && coachIds.length === 0) return [];
  const rows = await db
    .select()
    .from(groupSessions)
    .where(
      and(
        eq(groupSessions.status, "open"),
        gt(groupSessions.startTime, now),
        coachIds ? inArray(groupSessions.coachId, coachIds) : undefined,
      ),
    )
    .orderBy(asc(groupSessions.startTime));
  return withSpots(db, rows, now);
}

export async function groupSessionWithSpots(
  db: Database,
  id: string,
  now: Date,
): Promise<SessionWithSpots | null> {
  const session = await groupSessionById(db, id);
  return session ? (await withSpots(db, [session], now))[0]! : null;
}

export interface CoachSession extends SessionWithSpots {
  /** Paid bookings, for the coach's list of who's coming. */
  bookings: GroupBooking[];
}

/** A coach's sessions: upcoming ones (open or cancelled) and the last few past. */
export async function groupSessionsForCoach(
  db: Database,
  coachId: string,
  now: Date,
  range?: { from: Date; to: Date },
): Promise<CoachSession[]> {
  const rows = await db
    .select()
    .from(groupSessions)
    .where(
      and(
        eq(groupSessions.coachId, coachId),
        range
          ? and(
              sql`${groupSessions.startTime} >= ${range.from.toISOString()}::timestamptz`,
              sql`${groupSessions.startTime} < ${range.to.toISOString()}::timestamptz`,
            )
          : sql`${groupSessions.endTime} > ${new Date(now.getTime() - 30 * 86_400_000).toISOString()}::timestamptz`,
      ),
    )
    .orderBy(asc(groupSessions.startTime));
  const sessions = await withSpots(db, rows, now);
  if (sessions.length === 0) return [];
  const bookings = await db
    .select()
    .from(groupBookings)
    .where(
      and(
        inArray(
          groupBookings.sessionId,
          sessions.map((s) => s.id),
        ),
        eq(groupBookings.status, "paid"),
      ),
    )
    .orderBy(asc(groupBookings.paidAt));
  return sessions.map((s) => ({ ...s, bookings: bookings.filter((b) => b.sessionId === s.id) }));
}

/* Bookings */

export class GroupSessionFull extends Error {
  constructor(readonly left: number) {
    super(left > 0 ? `Only ${left} left` : "Full");
  }
}

export class GroupSessionClosed extends Error {
  constructor() {
    super("This session can't be booked any more");
  }
}

export interface NewGroupBooking {
  sessionId: string;
  spots: number;
  golferName: string;
  golferEmail: string;
  golferPhone: string;
  note?: string;
  userId?: string | null;
  feeCents: number;
  provider: string;
}

/**
 * Hold spots at checkout for CHECKOUT_MINUTES. Throws GroupSessionFull if
 * there aren't enough left, or GroupSessionClosed if it's cancelled or started.
 */
export async function createGroupBooking(
  db: Database,
  input: NewGroupBooking,
  now: Date,
): Promise<GroupBooking> {
  return db.transaction(async (tx) => {
    // Lock the session so two golfers can't take the last spot at once.
    const [session] = await tx
      .select()
      .from(groupSessions)
      .where(eq(groupSessions.id, input.sessionId))
      .for("update");
    if (!session || session.status !== "open" || session.startTime <= now)
      throw new GroupSessionClosed();
    const taken =
      (await spotsTaken(tx as unknown as Database, [session.id], now)).get(session.id) ?? 0;
    const left = session.spots - taken;
    if (input.spots > left) throw new GroupSessionFull(Math.max(0, left));
    const [row] = await tx
      .insert(groupBookings)
      .values({
        sessionId: session.id,
        spots: input.spots,
        golferName: input.golferName,
        golferEmail: input.golferEmail.toLowerCase(),
        golferPhone: input.golferPhone,
        note: input.note || null,
        userId: input.userId ?? null,
        spotsCents: session.priceCents * input.spots,
        feeCents: input.feeCents,
        manageToken: randomBytes(24).toString("base64url"),
        provider: input.provider,
        checkoutExpiresAt: new Date(now.getTime() + CHECKOUT_MINUTES * 60_000),
        createdAt: now,
      })
      .returning();
    return row!;
  });
}

export async function setGroupCheckout(
  db: Database,
  id: string,
  checkoutId: string,
): Promise<void> {
  await db.update(groupBookings).set({ checkoutId }).where(eq(groupBookings.id, id));
}

export async function groupBookingById(db: Database, id: string): Promise<GroupBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(groupBookings).where(eq(groupBookings.id, id));
  return row ?? null;
}

export async function groupBookingByToken(
  db: Database,
  token: string,
): Promise<GroupBooking | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(groupBookings).where(eq(groupBookings.manageToken, token));
  return row ?? null;
}

export async function groupBookingByCheckout(
  db: Database,
  checkoutId: string,
): Promise<GroupBooking | null> {
  const [row] = await db
    .select()
    .from(groupBookings)
    .where(eq(groupBookings.checkoutId, checkoutId));
  return row ?? null;
}

async function moveBooking(
  db: Database,
  id: string,
  from: GroupBookingStatus[],
  set: Partial<typeof groupBookings.$inferInsert>,
): Promise<GroupBooking | null> {
  const [row] = await db
    .update(groupBookings)
    .set(set)
    .where(and(eq(groupBookings.id, id), inArray(groupBookings.status, from)))
    .returning();
  return row ?? null;
}

export function markGroupPaid(db: Database, id: string, paymentId: string, now: Date) {
  return moveBooking(db, id, ["checkout"], { status: "paid", paymentId, paidAt: now });
}

export function markGroupAbandoned(db: Database, id: string) {
  return moveBooking(db, id, ["checkout"], { status: "abandoned" });
}

export function cancelGroupBooking(
  db: Database,
  id: string,
  input: { by: "golfer" | "coach" | "minimum"; refundCents: number },
  now: Date,
) {
  return moveBooking(db, id, ["paid"], {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: input.by,
    refundCents: input.refundCents,
  });
}

export function groupBookingTotalCents(
  booking: Pick<GroupBooking, "spotsCents" | "feeCents">,
): number {
  return booking.spotsCents + booking.feeCents;
}

/* Sessions */

/** Close a session: no more bookings. Its paid bookings are refunded by @bookon/payments. */
export async function cancelGroupSession(
  db: Database,
  id: string,
  input: { by: "coach" | "minimum"; note?: string | null },
  now: Date,
): Promise<GroupSession | null> {
  const [row] = await db
    .update(groupSessions)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: input.by,
      coachNote: input.note || null,
    })
    .where(and(eq(groupSessions.id, id), eq(groupSessions.status, "open")))
    .returning();
  return row ?? null;
}

export async function markGroupGoingAhead(db: Database, id: string, now: Date): Promise<void> {
  await db
    .update(groupSessions)
    .set({ goingAheadAt: now })
    .where(and(eq(groupSessions.id, id), isNull(groupSessions.goingAheadAt)));
}

/** Sessions with a minimum that's now due to be checked. */
export function sessionsDueMinimumCheck(db: Database, now: Date): Promise<GroupSession[]> {
  const due = new Date(now.getTime() + MINIMUM_CHECK_HOURS * 3_600_000);
  return db
    .select()
    .from(groupSessions)
    .where(
      and(
        eq(groupSessions.status, "open"),
        isNotNull(groupSessions.minSpots),
        isNull(groupSessions.goingAheadAt),
        lte(groupSessions.startTime, due),
      ),
    );
}

/** Paid bookings on a cancelled session: each still to be refunded. */
export async function bookingsToRefund(db: Database, sessionId?: string) {
  return db
    .select({ booking: groupBookings, session: groupSessions })
    .from(groupBookings)
    .innerJoin(groupSessions, eq(groupSessions.id, groupBookings.sessionId))
    .where(
      and(
        eq(groupBookings.status, "paid"),
        eq(groupSessions.status, "cancelled"),
        sessionId ? eq(groupSessions.id, sessionId) : undefined,
      ),
    );
}

export function staleGroupCheckouts(db: Database, now: Date): Promise<GroupBooking[]> {
  return db
    .select()
    .from(groupBookings)
    .where(and(eq(groupBookings.status, "checkout"), lte(groupBookings.checkoutExpiresAt, now)));
}

/* Lists */

export async function listGroupBookingsForAdmin(db: Database, limit = 200) {
  return db
    .select({
      booking: groupBookings,
      session: groupSessions,
      coachName: sql<string>`${coaches.profile}->>'name'`,
    })
    .from(groupBookings)
    .innerJoin(groupSessions, eq(groupSessions.id, groupBookings.sessionId))
    .innerJoin(coaches, eq(coaches.id, groupSessions.coachId))
    .where(inArray(groupBookings.status, ["paid", "cancelled"]))
    .orderBy(desc(groupBookings.createdAt))
    .limit(limit);
}

export interface GroupTotals {
  /** Bookings paid in the period. */
  bookings: number;
  spots: number;
  /** Paid to coaches, less refunds. */
  coachCents: number;
  /** Booking fees kept, less refunds. */
  feeCents: number;
}

/** Group bookings paid from `from` up to `to`, for Reports. */
export async function groupTotals(db: Database, from: Date, to: Date): Promise<GroupTotals> {
  const rows = await db
    .select()
    .from(groupBookings)
    .where(
      and(
        isNotNull(groupBookings.paidAt),
        sql`${groupBookings.paidAt} >= ${from.toISOString()}::timestamptz`,
        sql`${groupBookings.paidAt} < ${to.toISOString()}::timestamptz`,
      ),
    );
  const kept = rows.filter((b) => b.refundCents === 0);
  return {
    bookings: rows.length,
    spots: rows.reduce((sum, b) => sum + b.spots, 0),
    coachCents: kept.reduce((sum, b) => sum + b.spotsCents, 0),
    feeCents: kept.reduce((sum, b) => sum + b.feeCents, 0),
  };
}

/** A golfer's group bookings, by their email or their account, with each session. */
export async function groupBookingsForGolfer(db: Database, email: string, userId?: string) {
  return db
    .select({ booking: groupBookings, session: groupSessions })
    .from(groupBookings)
    .innerJoin(groupSessions, eq(groupSessions.id, groupBookings.sessionId))
    .where(
      and(
        or(
          eq(groupBookings.golferEmail, email.toLowerCase()),
          userId ? eq(groupBookings.userId, userId) : undefined,
        ),
        inArray(groupBookings.status, ["paid", "cancelled"]),
      ),
    )
    .orderBy(desc(groupSessions.startTime));
}
