import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { perthDate } from "@bookon/core";
import type { Database } from "./client";
import { alerts, notifications } from "./schema";
import { searchTeeTimes, type ResultTeeTime, type SearchParams } from "./search";

/** Most alerts one golfer can have running or paused. */
export const MAX_ALERTS_PER_GOLFER = 10;
/** At most one email per alert in this window. New slots found meanwhile go in the next one. */
export const ALERT_EMAIL_GAP_MS = 60 * 60 * 1000;

export type Alert = typeof alerts.$inferSelect;
export type AlertStatus = Alert["status"];

export function alertFilters(alert: Alert): SearchParams {
  return alert.filters as unknown as SearchParams;
}

/**
 * Save a search as an alert. Tee times already showing are recorded as seen,
 * so the golfer only hears about new ones.
 */
export async function createAlert(
  db: Database,
  input: {
    userId: string;
    email: string;
    filters: SearchParams;
    now: Date;
    /** Also notify by push, when the golfer has allowed it on a device. */
    push?: boolean;
  },
): Promise<{ alert: Alert } | { error: "limit" }> {
  const [live] = await db
    .select({ n: count() })
    .from(alerts)
    .where(and(eq(alerts.userId, input.userId), inArray(alerts.status, ["active", "paused"])));
  if ((live?.n ?? 0) >= MAX_ALERTS_PER_GOLFER) return { error: "limit" };

  const [alert] = await db
    .insert(alerts)
    .values({
      userId: input.userId,
      createdAt: input.now,
      contactType: "email",
      contactValue: input.email,
      filters: input.filters as unknown as Record<string, unknown>,
      status: "active",
      confirmedAt: input.now,
      manageToken: randomBytes(24).toString("base64url"),
      notifyPush: input.push ?? false,
    })
    .returning();

  const showing = await searchTeeTimes(db, input.filters, input.now);
  const seen = showing.courses.flatMap((c) =>
    c.teeTimes.map((t) => ({
      alertId: alert!.id,
      courseId: c.course.id,
      startTime: t.startTime,
      holes: t.holes,
      channel: "email" as const,
      sentAt: input.now,
      baseline: true,
    })),
  );
  if (seen.length > 0) await db.insert(notifications).values(seen).onConflictDoNothing();
  return { alert: alert! };
}

export async function listAlerts(db: Database, userId: string): Promise<Alert[]> {
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), inArray(alerts.status, ["active", "paused", "ended"])))
    .orderBy(alerts.createdAt);
}

export async function alertByManageToken(db: Database, token: string): Promise<Alert | null> {
  const [alert] = await db.select().from(alerts).where(eq(alerts.manageToken, token));
  return alert ?? null;
}

/** Pause, resume or delete. Ended alerts stay ended. Ownership is the caller's job. */
export async function setAlertStatus(
  db: Database,
  alertId: string,
  status: "active" | "paused" | "deleted",
): Promise<void> {
  await db
    .update(alerts)
    .set({ status })
    .where(and(eq(alerts.id, alertId), sql`${alerts.status} <> 'ended'`));
}

/** Alerts whose last date has passed stop. */
export async function endExpiredAlerts(db: Database, now: Date): Promise<number> {
  const ended = await db
    .update(alerts)
    .set({ status: "ended" })
    .where(
      and(
        inArray(alerts.status, ["active", "paused"]),
        sql`${alerts.filters}->>'dateTo' < ${perthDate(now)}`,
      ),
    )
    .returning({ id: alerts.id });
  return ended.length;
}

export interface AlertMatch {
  course: { id: string; slug: string; name: string; suburb: string };
  teeTime: ResultTeeTime;
}

export interface AlertWithMatches {
  alert: Alert;
  matches: AlertMatch[];
}

/**
 * New tee times for each active alert, not yet emailed or seen, from fresh
 * data only. Alerts emailed within the last hour wait their turn.
 */
export async function findNewAlertMatches(db: Database, now: Date): Promise<AlertWithMatches[]> {
  const due = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.status, "active"),
        or(
          isNull(alerts.lastNotifiedAt),
          lt(alerts.lastNotifiedAt, new Date(now.getTime() - ALERT_EMAIL_GAP_MS)),
        ),
      ),
    );

  const today = perthDate(now);
  const results: AlertWithMatches[] = [];
  for (const alert of due) {
    const filters = alertFilters(alert);
    const params = { ...filters, dateFrom: filters.dateFrom < today ? today : filters.dateFrom };
    if (params.dateFrom > params.dateTo) continue;

    const found = await searchTeeTimes(db, params, now);
    const known = await db
      .select({
        courseId: notifications.courseId,
        startTime: notifications.startTime,
        holes: notifications.holes,
      })
      .from(notifications)
      .where(eq(notifications.alertId, alert.id));
    const knownKeys = new Set(
      known.map((k) => `${k.courseId}|${k.startTime.toISOString()}|${k.holes}`),
    );

    const matches = found.courses.flatMap((c) =>
      c.teeTimes
        .filter((t) => !knownKeys.has(`${c.course.id}|${t.startTime.toISOString()}|${t.holes}`))
        .map((t) => ({ course: c.course, teeTime: t })),
    );
    if (matches.length > 0) results.push({ alert, matches });
  }
  return results;
}

export interface NotificationRow {
  id: string;
  courseId: string;
  startTime: Date;
  holes: number;
  /** Null when there's no signing key, so the email linked straight to the club. */
  clickToken: string | null;
}

/** A notification id to sign into each emailed link before recording it. */
export function newNotificationId(): string {
  return randomUUID();
}

/** Record that these slots were sent, so each is only ever sent once. */
export async function recordAlertRound(
  db: Database,
  alertId: string,
  rows: NotificationRow[],
  now: Date,
  channel: "email" | "push" = "email",
): Promise<void> {
  await db.transaction(async (tx) => {
    if (rows.length > 0) {
      await tx
        .insert(notifications)
        .values(rows.map((r) => ({ ...r, alertId, channel, sentAt: now })))
        .onConflictDoNothing();
    }
    await tx.update(alerts).set({ lastNotifiedAt: now }).where(eq(alerts.id, alertId));
  });
}
