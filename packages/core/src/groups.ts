import { FREE_CANCEL_HOURS } from "./lessons";
import { addPerthDays } from "./time";

/**
 * Group sessions (Milestone 19): a clinic or squad the coach runs for several
 * golfers at once. Golfers buy one or more spots and are charged straight
 * away. A session with a minimum is called off, and everyone refunded, if
 * it isn't reached by MINIMUM_CHECK_HOURS before the start.
 */

export const GROUP_MAX_SPOTS = 40;
/** Spots one golfer can buy in one go, for themselves and friends or kids. */
export const GROUP_MAX_PER_ORDER = 8;
/** How many weeks a weekly session can be set up for at once. */
export const GROUP_MAX_WEEKS = 12;
/** How far ahead a session can be put on. */
export const GROUP_DAYS_AHEAD = 120;
/** Golfers can cancel for a refund up to this long before, the same as lessons. */
export const GROUP_FREE_CANCEL_HOURS = FREE_CANCEL_HOURS;
/** When a session's minimum is checked. */
export const MINIMUM_CHECK_HOURS = 24;

const HOUR = 60 * 60 * 1000;

/** The Perth dates of a session repeated weekly: the first, then each week after. */
export function weeklyDates(first: string, weeks: number): string[] {
  return Array.from({ length: Math.max(1, weeks) }, (_, i) => addPerthDays(first, i * 7));
}

/** When the minimum is decided: MINIMUM_CHECK_HOURS before the start. */
export function minimumCheckAt(start: Date): Date {
  return new Date(start.getTime() - MINIMUM_CHECK_HOURS * HOUR);
}

/** Whether a golfer who cancels now gets their money back. */
export function groupFreeToCancel(start: Date, now: Date): boolean {
  return start.getTime() - now.getTime() >= GROUP_FREE_CANCEL_HOURS * HOUR;
}

/** "1 spot left", "6 spots left", "Full". */
export function spotsLeftLabel(left: number): string {
  if (left <= 0) return "Full";
  return `${left} ${left === 1 ? "spot" : "spots"} left`;
}
