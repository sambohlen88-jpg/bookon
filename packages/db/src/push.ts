import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "./client";
import { alerts, appSettings, courses, notifications, pushSubscriptions } from "./schema";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string | null;
}

/** Only real push services, so a stored endpoint can't make the worker call anywhere else. */
export function validPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && endpoint.length <= 1000;
  } catch {
    return false;
  }
}

/**
 * Save a device's push subscription. A device belongs to whoever signed in on
 * it last, so re-subscribing moves it to this golfer.
 */
export async function savePushSubscription(
  db: Database,
  userId: string,
  input: PushSubscriptionInput,
  now: Date,
): Promise<void> {
  const values = {
    userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    deviceLabel: input.deviceLabel?.slice(0, 60) ?? null,
    createdAt: now,
  };
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: values.p256dh, auth: values.auth, deviceLabel: values.deviceLabel },
    });
}

export async function removePushSubscription(
  db: Database,
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPushSubscriptions(
  db: Database,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt));
}

/** The push service says this device is gone (uninstalled, or notifications blocked). */
export async function deletePushSubscriptionById(db: Database, id: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}

export async function markPushDelivered(db: Database, id: string, now: Date): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastSuccessAt: now })
    .where(eq(pushSubscriptions.id, id));
}

/** Choose how an alert reaches the golfer. At least one channel stays on. */
export async function setAlertChannels(
  db: Database,
  alertId: string,
  channels: { email: boolean; push: boolean },
): Promise<void> {
  if (!channels.email && !channels.push) return;
  await db
    .update(alerts)
    .set({ notifyEmail: channels.email, notifyPush: channels.push })
    .where(eq(alerts.id, alertId));
}

/** Turn push on for all of a golfer's alerts, when they first allow notifications. */
export async function enablePushForAlerts(db: Database, userId: string): Promise<void> {
  await db
    .update(alerts)
    .set({ notifyPush: true })
    .where(and(eq(alerts.userId, userId), inArray(alerts.status, ["active", "paused"])));
}

export interface SentSlot {
  courseId: string;
  courseSlug: string;
  courseName: string;
  startTime: Date;
  holes: number;
  clickToken: string | null;
}

/** The tee times in an alert's most recent notification, for the page a push opens. */
export async function latestAlertRound(
  db: Database,
  alert: { id: string; lastNotifiedAt: Date | null },
): Promise<SentSlot[]> {
  if (!alert.lastNotifiedAt) return [];
  return db
    .select({
      courseId: notifications.courseId,
      courseSlug: courses.slug,
      courseName: courses.name,
      startTime: notifications.startTime,
      holes: notifications.holes,
      clickToken: notifications.clickToken,
    })
    .from(notifications)
    .innerJoin(courses, eq(courses.id, notifications.courseId))
    .where(
      and(
        eq(notifications.alertId, alert.id),
        eq(notifications.baseline, false),
        eq(notifications.sentAt, alert.lastNotifiedAt),
      ),
    )
    .orderBy(notifications.startTime);
}

export async function getSetting<T>(db: Database, key: string): Promise<T | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return (row?.value as T | undefined) ?? null;
}

/** Store a setting unless one is already there; returns whichever value won. */
export async function setSettingOnce<T>(db: Database, key: string, value: T): Promise<T> {
  await db
    .insert(appSettings)
    .values({ key, value: value as unknown as Record<string, unknown> })
    .onConflictDoNothing();
  return (await getSetting<T>(db, key))!;
}
