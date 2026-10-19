import { CalendarReadError, fetchBusyTimes } from "@bookon/adapters/calendar";
import {
  coachesWithBusyCalendars,
  saveBusyCalendarError,
  saveBusyCalendarRead,
  type Database,
} from "@bookon/db";

/** Read a calendar again once it's this old. The worker passes every 30 minutes. */
const REFRESH_MINUTES = 25;
/** Busy times are kept for the booking window and a little more. */
const AHEAD_DAYS = 35;

export interface CalendarRefreshResult {
  read: number;
  fresh: number;
  failed: number;
}

/**
 * Re-read each coach's own calendar link for busy times (Milestone 16). A
 * failed read keeps the last good busy times and tells the coach why.
 */
export async function refreshCoachCalendars(
  db: Database,
  options: { userAgent: string; now: Date; fetch?: typeof fetch },
): Promise<CalendarRefreshResult> {
  const result: CalendarRefreshResult = { read: 0, fresh: 0, failed: 0 };
  const from = new Date(options.now.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(options.now.getTime() + AHEAD_DAYS * 24 * 60 * 60 * 1000);
  for (const coach of await coachesWithBusyCalendars(db)) {
    if (coach.readAt && options.now.getTime() - coach.readAt.getTime() < REFRESH_MINUTES * 60_000) {
      result.fresh++;
      continue;
    }
    try {
      const busy = await fetchBusyTimes(coach.url!, {
        userAgent: options.userAgent,
        from,
        to,
        fetch: options.fetch,
      });
      await saveBusyCalendarRead(db, coach.id, busy, options.now);
      result.read++;
    } catch (error) {
      result.failed++;
      const message =
        error instanceof CalendarReadError
          ? error.message
          : "Your calendar couldn't be read just now. We'll try again soon.";
      if (!(error instanceof CalendarReadError))
        console.error(`[calendars] could not read coach ${coach.id}'s calendar`, error);
      await saveBusyCalendarError(db, coach.id, message, options.now);
    }
  }
  return result;
}
