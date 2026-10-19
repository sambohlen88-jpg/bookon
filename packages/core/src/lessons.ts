/**
 * Booking and paying for lessons (Milestone 15). The golfer picks a time in
 * the coach's usual hours and their card is held; the coach accepts (the card
 * is charged) or declines (the hold is released).
 */
import { isoWeekday, type CoachProfile, type CoachRate } from "./coaching";
import { addPerthDays, perthDate, perthToUtc } from "./time";

/** Lesson times start on the hour and half hour. */
export const LESSON_STEP_MINUTES = 30;
/** The coach needs time to answer, so the soonest time is this far ahead. */
export const MIN_NOTICE_HOURS = 12;
/** How far ahead golfers can book. */
export const BOOKING_DAYS = 28;
/** How long the coach has to accept or decline. */
export const RESPOND_HOURS = 48;
/** ...but at least this long before the lesson, so nobody turns up unconfirmed. */
export const RESPOND_BEFORE_LESSON_HOURS = 2;
/** Golfers can cancel for a full refund up to this long before. */
export const FREE_CANCEL_HOURS = 24;
/** How long a golfer has to pay on the checkout page. Stripe's shortest is 30 minutes. */
export const CHECKOUT_MINUTES = 30;
export const DEFAULT_BOOKING_FEE_CENTS = 250;

const HOUR = 60 * 60 * 1000;

/** Group clinics are priced per person and stay "contact the coach". */
export function bookableRates(profile: Pick<CoachProfile, "rates">): CoachRate[] {
  return profile.rates.filter((r) => r.people !== "group" && r.priceCents > 0 && r.minutes > 0);
}

export interface TakenTime {
  start: Date;
  end: Date;
}

function minutesOf(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h! * 60 + m!;
}

function clockOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Start times for a lesson of `minutes` on a Perth date: inside the coach's
 * hours, not on a day away, at least MIN_NOTICE_HOURS from now, within
 * BOOKING_DAYS, and not overlapping a lesson already held or booked.
 */
export function lessonSlots(
  profile: Pick<CoachProfile, "hours" | "away">,
  minutes: number,
  date: string,
  now: Date,
  taken: TakenTime[],
): Date[] {
  const today = perthDate(now);
  if (date < today || date > addPerthDays(today, BOOKING_DAYS)) return [];
  if (profile.away.some((a) => a.from <= date && date <= a.to)) return [];
  const earliest = now.getTime() + MIN_NOTICE_HOURS * HOUR;
  const slots: Date[] = [];
  for (const block of profile.hours.filter((h) => h.day === isoWeekday(date))) {
    const end = minutesOf(block.to);
    // Line up with the half hour, so times read "9:00, 9:30", even from a 9:15 start.
    let at = Math.ceil(minutesOf(block.from) / LESSON_STEP_MINUTES) * LESSON_STEP_MINUTES;
    for (; at + minutes <= end; at += LESSON_STEP_MINUTES) {
      const start = perthToUtc(date, clockOf(at));
      const finish = new Date(start.getTime() + minutes * 60_000);
      if (start.getTime() < earliest) continue;
      if (taken.some((t) => t.start < finish && start < t.end)) continue;
      if (!slots.some((s) => s.getTime() === start.getTime())) slots.push(start);
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** The Perth dates a golfer can pick from: today to BOOKING_DAYS ahead. */
export function bookingDates(now: Date): string[] {
  const today = perthDate(now);
  return Array.from({ length: BOOKING_DAYS + 1 }, (_, i) => addPerthDays(today, i));
}

/** When a request lapses if the coach hasn't answered. */
export function respondBy(requestedAt: Date, lessonStart: Date): Date {
  return new Date(
    Math.min(
      requestedAt.getTime() + RESPOND_HOURS * HOUR,
      lessonStart.getTime() - RESPOND_BEFORE_LESSON_HOURS * HOUR,
    ),
  );
}

/** Whether a golfer cancelling a confirmed lesson now gets their money back. */
export function freeToCancel(lessonStart: Date, now: Date): boolean {
  return lessonStart.getTime() - now.getTime() >= FREE_CANCEL_HOURS * HOUR;
}
