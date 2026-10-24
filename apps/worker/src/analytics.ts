import { addPerthDays, isoWeekday, perthDate, perthToUtc } from "@bookon/core";
import {
  analyticsSettings,
  claimWeeklySummary,
  purgeAnalytics,
  weeklySummary,
  type Database,
} from "@bookon/db";
import { weeklySummaryEmail, type Mailer } from "@bookon/email";

/** The Monday summary goes out after this Perth time. */
export const WEEKLY_SUMMARY_TIME = "07:00";

/**
 * Analytics upkeep (Milestone 23): delete page views older than 13 months,
 * and on Monday morning email the admin last week's summary, once.
 */
export async function analyticsUpkeep(input: {
  db: Database;
  mailer: Mailer;
  site: string;
  now: Date;
  /** BOOKON_ADMIN_EMAIL; no summary without it. */
  adminEmail: string | null;
}): Promise<{ purged: number; sent: boolean }> {
  const { db, now } = input;
  const purged = await purgeAnalytics(db, now);
  const today = perthDate(now);
  const due = isoWeekday(today) === 1 && now >= perthToUtc(today, WEEKLY_SUMMARY_TIME);
  if (!due || !input.adminEmail || !(await analyticsSettings(db)).weeklyEmail)
    return { purged, sent: false };
  if (!(await claimWeeklySummary(db, today, now))) return { purged, sent: false };
  const summary = await weeklySummary(db, {
    from: addPerthDays(today, -7),
    to: addPerthDays(today, -1),
  });
  await input.mailer.send(
    weeklySummaryEmail({
      to: input.adminEmail,
      summary,
      link: `${input.site}/admin/analytics?range=custom&from=${summary.span.from}&to=${summary.span.to}`,
    }),
  );
  return { purged, sent: true };
}
