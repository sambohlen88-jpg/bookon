import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  CHECKOUT_MINUTES,
  DEFAULT_BOOKING_FEE_CENTS,
  respondBy,
  type CoachRate,
  type TakenTime,
} from "@bookon/core";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import { appSettings, coachBusy, coaches, lessonBookings } from "./schema";

/**
 * Lesson bookings (Milestone 15). These functions only move a booking from
 * one state to the next; taking, charging and refunding money happens in
 * @bookon/payments, which calls them. Each move only happens from the state
 * it expects, so a double click or a late webhook can't apply it twice.
 */

export type LessonBooking = typeof lessonBookings.$inferSelect;
export type LessonStatus = LessonBooking["status"];

/** What coaches agree to before taking payments through BookOn. Bump the version when it changes. */
export const LESSON_PAYMENT_TERMS_VERSION = 1;
export const LESSON_PAYMENT_TERMS =
  "I'll take lesson bookings and payments through BookOn. Golfers pay my full lesson price plus BookOn's booking fee; Stripe pays my price to my bank. I'll accept or decline each request within 48 hours, and refund in full any lesson I cancel. A golfer who cancels 24 hours or more before gets a full refund. The lesson is between me and the golfer.";

export interface LessonPaymentSettings {
  /** Golfers can book and pay for lessons. */
  enabled: boolean;
  feeCents: number;
}

export async function lessonPaymentSettings(db: Database): Promise<LessonPaymentSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "lesson_payments"));
  const value = (row?.value ?? {}) as Partial<LessonPaymentSettings>;
  return {
    enabled: value.enabled ?? true,
    feeCents: value.feeCents ?? DEFAULT_BOOKING_FEE_CENTS,
  };
}

export async function setLessonPaymentSettings(
  db: Database,
  settings: LessonPaymentSettings,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "lesson_payments", value: settings, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: settings, updatedAt: now } });
  await logChange(db, actor, { action: "Changed lesson payments", details: { ...settings } }, now);
}

/* Coaches' payment accounts */

export async function setCoachPaymentAccount(
  db: Database,
  coachId: string,
  accountId: string,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({ paymentAccountId: accountId, paymentsReady: false, updatedAt: now })
    .where(eq(coaches.id, coachId));
}

/** Record what Stripe says about the account. Bookings stop if it can no longer take payments. */
export async function setCoachPaymentsReady(
  db: Database,
  accountId: string,
  ready: boolean,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({ paymentsReady: ready, ...(ready ? {} : { takesBookings: false }), updatedAt: now })
    .where(eq(coaches.paymentAccountId, accountId));
}

export async function setCoachTakesBookings(
  db: Database,
  coachId: string,
  on: boolean,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(coaches)
    .set({ takesBookings: on, updatedAt: now })
    .where(and(eq(coaches.id, coachId), on ? eq(coaches.paymentsReady, true) : undefined))
    .returning({ id: coaches.id });
  return rows.length > 0;
}

/** Keep the coach's agreement to the payment terms with their listing's other consents. */
export async function acceptLessonPaymentTerms(
  db: Database,
  coachId: string,
  by: string,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({
      consents: sql`${coaches.consents} || ${JSON.stringify({
        payments: {
          by,
          at: now.toISOString(),
          version: LESSON_PAYMENT_TERMS_VERSION,
          text: LESSON_PAYMENT_TERMS,
        },
      })}::jsonb`,
      updatedAt: now,
    })
    .where(eq(coaches.id, coachId));
}

export function acceptedLessonPaymentTerms(consents: Record<string, unknown>): boolean {
  const payments = consents.payments as { version?: number } | undefined;
  return payments?.version === LESSON_PAYMENT_TERMS_VERSION;
}

/* Bookings */

/**
 * Times a coach can't be booked: lessons held or booked, checkouts still
 * open, times they blocked out, and busy times from their own calendar.
 */
export async function takenLessonTimes(
  db: Database,
  coachId: string,
  now: Date,
): Promise<TakenTime[]> {
  // One after another: the local database takes one query at a time.
  const lessons = await db
    .select({ start: lessonBookings.startTime, end: lessonBookings.endTime })
    .from(lessonBookings)
    .where(
      and(
        eq(lessonBookings.coachId, coachId),
        gt(lessonBookings.endTime, now),
        or(
          inArray(lessonBookings.status, ["requested", "confirmed"]),
          and(eq(lessonBookings.status, "checkout"), gt(lessonBookings.checkoutExpiresAt, now)),
        ),
      ),
    );
  const busy = await db
    .select({ start: coachBusy.startTime, end: coachBusy.endTime })
    .from(coachBusy)
    .where(and(eq(coachBusy.coachId, coachId), gt(coachBusy.endTime, now)));
  return [...lessons, ...busy];
}

export class LessonTimeTaken extends Error {
  constructor() {
    super("That time was just taken");
  }
}

export interface NewLessonBooking {
  coachId: string;
  rate: CoachRate;
  startTime: Date;
  place: string;
  golferName: string;
  golferEmail: string;
  golferPhone: string;
  note?: string;
  userId?: string | null;
  feeCents: number;
  provider: string;
}

/**
 * Start a booking at checkout, holding the time for CHECKOUT_MINUTES. Throws
 * LessonTimeTaken if it overlaps a lesson already held or booked.
 */
export async function createLessonBooking(
  db: Database,
  input: NewLessonBooking,
  now: Date,
): Promise<LessonBooking> {
  const endTime = new Date(input.startTime.getTime() + input.rate.minutes * 60_000);
  const booking = await db.transaction(async (tx) => {
    // Lock the coach so two golfers can't take the same time at once.
    await tx
      .select({ id: coaches.id })
      .from(coaches)
      .where(eq(coaches.id, input.coachId))
      .for("update");
    const taken = await takenLessonTimes(tx as unknown as Database, input.coachId, now);
    if (taken.some((t) => t.start < endTime && input.startTime < t.end))
      throw new LessonTimeTaken();
    const [row] = await tx
      .insert(lessonBookings)
      .values({
        coachId: input.coachId,
        rate: input.rate,
        startTime: input.startTime,
        endTime,
        place: input.place,
        golferName: input.golferName,
        golferEmail: input.golferEmail.toLowerCase(),
        golferPhone: input.golferPhone,
        note: input.note || null,
        userId: input.userId ?? null,
        lessonCents: input.rate.priceCents,
        feeCents: input.feeCents,
        manageToken: randomBytes(24).toString("base64url"),
        provider: input.provider,
        checkoutExpiresAt: new Date(now.getTime() + CHECKOUT_MINUTES * 60_000),
        createdAt: now,
      })
      .returning();
    return row!;
  });
  return booking;
}

export async function setLessonCheckout(
  db: Database,
  id: string,
  checkoutId: string,
): Promise<void> {
  await db.update(lessonBookings).set({ checkoutId }).where(eq(lessonBookings.id, id));
}

export async function lessonById(db: Database, id: string): Promise<LessonBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(lessonBookings).where(eq(lessonBookings.id, id));
  return row ?? null;
}

export async function lessonByToken(db: Database, token: string): Promise<LessonBooking | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(lessonBookings).where(eq(lessonBookings.manageToken, token));
  return row ?? null;
}

export async function lessonByCheckout(
  db: Database,
  checkoutId: string,
): Promise<LessonBooking | null> {
  const [row] = await db
    .select()
    .from(lessonBookings)
    .where(eq(lessonBookings.checkoutId, checkoutId));
  return row ?? null;
}

/** Move a booking on, only from the state it's expected to be in. Null if it had already moved. */
async function move(
  db: Database,
  id: string,
  from: LessonStatus[],
  set: Partial<typeof lessonBookings.$inferInsert>,
): Promise<LessonBooking | null> {
  const [row] = await db
    .update(lessonBookings)
    .set(set)
    .where(and(eq(lessonBookings.id, id), inArray(lessonBookings.status, from)))
    .returning();
  return row ?? null;
}

/** The golfer's card is held: the coach can now accept or decline. */
export function markLessonRequested(db: Database, id: string, paymentId: string, now: Date) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(lessonBookings).where(eq(lessonBookings.id, id));
    if (!booking || booking.status !== "checkout") return null;
    return move(tx as unknown as Database, id, ["checkout"], {
      status: "requested",
      paymentId,
      requestedAt: now,
      respondBy: respondBy(now, booking.startTime),
    });
  });
}

export function markLessonAbandoned(db: Database, id: string) {
  return move(db, id, ["checkout"], { status: "abandoned" });
}

export function acceptLesson(db: Database, id: string, now: Date) {
  return move(db, id, ["requested"], { status: "confirmed", decidedAt: now });
}

export function declineLesson(db: Database, id: string, note: string | null, now: Date) {
  return move(db, id, ["requested"], { status: "declined", decidedAt: now, coachNote: note });
}

export function lapseLesson(db: Database, id: string, now: Date) {
  return move(db, id, ["requested"], { status: "lapsed", decidedAt: now });
}

export function cancelLesson(
  db: Database,
  id: string,
  input: { by: "golfer" | "coach"; refundCents: number; note?: string | null },
  now: Date,
) {
  return move(db, id, input.by === "coach" ? ["confirmed"] : ["requested", "confirmed"], {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: input.by,
    refundCents: input.refundCents,
    ...(input.note ? { coachNote: input.note } : {}),
  });
}

/** What the golfer paid, or has held on their card. */
export function lessonTotalCents(booking: Pick<LessonBooking, "lessonCents" | "feeCents">): number {
  return booking.lessonCents + booking.feeCents;
}

/* Lists */

export async function lessonsForCoach(db: Database, coachId: string, now: Date) {
  const rows = await db
    .select()
    .from(lessonBookings)
    .where(
      and(
        eq(lessonBookings.coachId, coachId),
        inArray(lessonBookings.status, [
          "requested",
          "confirmed",
          "declined",
          "lapsed",
          "cancelled",
        ]),
      ),
    )
    .orderBy(asc(lessonBookings.startTime));
  return {
    requests: rows.filter((b) => b.status === "requested"),
    upcoming: rows.filter((b) => b.status === "confirmed" && b.endTime > now),
    past: rows
      .filter((b) => b.status !== "requested" && !(b.status === "confirmed" && b.endTime > now))
      .reverse()
      .slice(0, 20),
  };
}

/** A golfer's lessons, by their email or their account. */
export async function lessonsForGolfer(
  db: Database,
  email: string,
  userId?: string,
): Promise<LessonBooking[]> {
  return db
    .select()
    .from(lessonBookings)
    .where(
      and(
        or(
          eq(lessonBookings.golferEmail, email.toLowerCase()),
          userId ? eq(lessonBookings.userId, userId) : undefined,
        ),
        inArray(lessonBookings.status, [
          "requested",
          "confirmed",
          "declined",
          "lapsed",
          "cancelled",
        ]),
      ),
    )
    .orderBy(desc(lessonBookings.startTime));
}

/** Requests the coach didn't answer in time. */
export function overdueLessonRequests(db: Database, now: Date): Promise<LessonBooking[]> {
  return db
    .select()
    .from(lessonBookings)
    .where(and(eq(lessonBookings.status, "requested"), lte(lessonBookings.respondBy, now)));
}

/** Checkouts past their time, to check with the payment provider and close. */
export function staleLessonCheckouts(db: Database, now: Date): Promise<LessonBooking[]> {
  return db
    .select()
    .from(lessonBookings)
    .where(and(eq(lessonBookings.status, "checkout"), lte(lessonBookings.checkoutExpiresAt, now)));
}

export async function listLessonsForAdmin(db: Database, limit = 200) {
  return db
    .select({ booking: lessonBookings, coachName: sql<string>`${coaches.profile}->>'name'` })
    .from(lessonBookings)
    .innerJoin(coaches, eq(coaches.id, lessonBookings.coachId))
    .where(
      inArray(lessonBookings.status, ["requested", "confirmed", "declined", "lapsed", "cancelled"]),
    )
    .orderBy(desc(lessonBookings.createdAt))
    .limit(limit);
}

export interface LessonTotals {
  /** Requests golfers paid for (card held), in the period. */
  requested: number;
  /** Lessons coaches accepted. */
  booked: number;
  /** Paid to coaches for accepted lessons, less refunds. */
  coachCents: number;
  /** Booking fees kept, less refunds. */
  feeCents: number;
}

/** Lessons requested from `from` up to `to`, for Reports. */
export async function lessonTotals(db: Database, from: Date, to: Date): Promise<LessonTotals> {
  const rows = await db
    .select()
    .from(lessonBookings)
    .where(
      and(
        isNotNull(lessonBookings.requestedAt),
        sql`${lessonBookings.requestedAt} >= ${from.toISOString()}::timestamptz`,
        sql`${lessonBookings.requestedAt} < ${to.toISOString()}::timestamptz`,
      ),
    );
  // Accepted lessons: confirmed, or cancelled after the coach accepted.
  const accepted = rows.filter(
    (b) => b.status === "confirmed" || (b.status === "cancelled" && b.decidedAt !== null),
  );
  const charged = accepted.filter((b) => b.refundCents === 0);
  return {
    requested: rows.length,
    booked: accepted.length,
    coachCents: charged.reduce((sum, b) => sum + b.lessonCents, 0),
    feeCents: charged.reduce((sum, b) => sum + b.feeCents, 0),
  };
}
