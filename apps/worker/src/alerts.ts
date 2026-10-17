import { clickSigningKey, createClickToken } from "@bookon/core";
import {
  alertFilters,
  endExpiredAlerts,
  findNewAlertMatches,
  newNotificationId,
  recordAlertEmail,
  type Database,
  type NotificationRow,
} from "@bookon/db";
import { alertEmail, searchUrlFor, type Mailer } from "@bookon/email";

export interface AlertRunResult {
  ended: number;
  sent: number;
  failed: number;
}

/**
 * After a poll: stop alerts whose days have passed, then email golfers about
 * tee times that are new since their last email. A failed send is not
 * recorded, so the same times go in the next attempt.
 */
export async function sendAlertEmails(
  db: Database,
  mailer: Mailer,
  options: { now: Date; site: string; key?: string | null },
): Promise<AlertRunResult> {
  const { now, site } = options;
  const key = options.key === undefined ? clickSigningKey() : options.key;
  const ended = await endExpiredAlerts(db, now);
  const due = await findNewAlertMatches(db, now);

  let sent = 0;
  let failed = 0;
  for (const { alert, matches } of due) {
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

    try {
      await mailer.send(
        alertEmail({
          to: alert.contactValue,
          filters: alertFilters(alert),
          matches: linked,
          searchUrl: searchUrlFor(site, alertFilters(alert)),
          manageUrl: `${site}/alerts/${alert.manageToken}`,
        }),
      );
    } catch (error) {
      failed++;
      console.error(`[alerts] could not email alert ${alert.id}`, error);
      continue;
    }
    await recordAlertEmail(db, alert.id, rows, now);
    sent++;
  }
  return { ended, sent, failed };
}
