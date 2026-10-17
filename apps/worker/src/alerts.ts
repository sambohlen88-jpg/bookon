import { clickSigningKey, createClickToken } from "@bookon/core";
import {
  alertFilters,
  deletePushSubscriptionById,
  endExpiredAlerts,
  findNewAlertMatches,
  listPushSubscriptions,
  markPushDelivered,
  newNotificationId,
  recordAlertRound,
  type Alert,
  type AlertMatch,
  type Database,
  type NotificationRow,
} from "@bookon/db";
import {
  alertEmail,
  alertPushPayload,
  searchUrlFor,
  type Mailer,
  type PushSender,
} from "@bookon/email";

export interface AlertRunResult {
  ended: number;
  /** Alerts that reached the golfer by at least one channel. */
  sent: number;
  failed: number;
  pushed: number;
  emailed: number;
}

/**
 * After a poll: stop alerts whose days have passed, then tell golfers about
 * tee times that are new since their last notification, by push, email or
 * both. If push was the only channel and no device took it, email instead so
 * nobody misses out. A round that reached nobody isn't recorded, so the same
 * times go in the next attempt.
 */
export async function sendAlertNotifications(
  db: Database,
  senders: { mailer: Mailer; push?: PushSender | null },
  options: { now: Date; site: string; key?: string | null },
): Promise<AlertRunResult> {
  const { now, site } = options;
  const key = options.key === undefined ? clickSigningKey() : options.key;
  const result: AlertRunResult = {
    ended: await endExpiredAlerts(db, now),
    sent: 0,
    failed: 0,
    pushed: 0,
    emailed: 0,
  };

  for (const { alert, matches } of await findNewAlertMatches(db, now)) {
    const { rows, linked } = signLinks(matches, site, key);
    const pushed =
      alert.notifyPush && senders.push && alert.userId
        ? await pushToDevices(db, senders.push, alert, matches, site, now)
        : false;

    let emailed = false;
    if (alert.notifyEmail || !pushed) {
      try {
        await senders.mailer.send(
          alertEmail({
            to: alert.contactValue,
            filters: alertFilters(alert),
            matches: linked,
            searchUrl: searchUrlFor(site, alertFilters(alert)),
            manageUrl: `${site}/alerts/${alert.manageToken}`,
          }),
        );
        emailed = true;
      } catch (error) {
        console.error(`[alerts] could not email alert ${alert.id}`, error);
      }
    }

    if (!pushed && !emailed) {
      result.failed++;
      continue;
    }
    await recordAlertRound(db, alert.id, rows, now, pushed && !emailed ? "push" : "email");
    result.sent++;
    if (pushed) result.pushed++;
    if (emailed) result.emailed++;
  }
  return result;
}

/** A tracked /go link for each tee time, each tied to its own notification. */
function signLinks(matches: AlertMatch[], site: string, key: string | null) {
  const rows: NotificationRow[] = [];
  const linked = matches.map((m) => {
    const id = newNotificationId();
    const token = key
      ? createClickToken(
          {
            courseId: m.course.id,
            startTime: m.teeTime.startTime.toISOString(),
            url: m.teeTime.bookingUrl,
            source: "alert",
            notificationId: id,
          },
          key,
        )
      : null;
    rows.push({
      id,
      courseId: m.course.id,
      startTime: m.teeTime.startTime,
      holes: m.teeTime.holes,
      clickToken: token,
    });
    return { ...m, href: token ? `${site}/go/${token}` : m.teeTime.bookingUrl };
  });
  return { rows, linked };
}

/** Push to every device the golfer allowed. True if at least one took it. */
async function pushToDevices(
  db: Database,
  sender: PushSender,
  alert: Alert,
  matches: AlertMatch[],
  site: string,
  now: Date,
): Promise<boolean> {
  const devices = await listPushSubscriptions(db, alert.userId!);
  const payload = alertPushPayload({
    alertId: alert.id,
    matches,
    url: `${site}/alerts/${alert.manageToken}?new=1`,
  });
  let delivered = false;
  for (const device of devices) {
    const outcome = await sender.send(device, payload);
    if (outcome.ok) {
      delivered = true;
      await markPushDelivered(db, device.id, now);
    } else if (outcome.gone) {
      await deletePushSubscriptionById(db, device.id);
    } else {
      console.error(`[alerts] push to a device failed for alert ${alert.id}: ${outcome.error}`);
    }
  }
  return delivered;
}
