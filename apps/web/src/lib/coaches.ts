import {
  WEEKDAYS,
  areaName,
  guessLessonKind,
  formatPrice,
  fromPriceCents,
  isoWeekday,
  perthDate,
  teachingDates,
  weekDates,
} from "@bookon/core";
import type { LiveCoach } from "@bookon/db";

/** "14:05" in Perth, to compare with a coach's hours. */
export function perthClock(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Perth",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/** "Tue" for a Perth date. */
export function dayLabel(date: string): string {
  return WEEKDAYS[isoWeekday(date) - 1]!;
}

/** "7 am", "3:30 pm" for a coach's "HH:MM" time. */
export function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** The dates this coach teaches this week and next, from their usual hours. */
export function coachWeeks(coach: Pick<LiveCoach, "profile">, now: Date) {
  const today = perthDate(now);
  return {
    thisWeek: teachingDates(coach.profile, weekDates(today, "this"), today, perthClock(now)),
    nextWeek: teachingDates(coach.profile, weekDates(today, "next")),
  };
}

/** What the Coaches page lists for each coach. Plain data, for the browser. */
export interface DirectoryCoach {
  slug: string;
  name: string;
  headline: string;
  suburb: string;
  area: string;
  areaName: string;
  /** Every area they teach in (Milestone 26): base, their places' courses, and where they travel. */
  areas: string[];
  /** Happy to travel to the golfer. */
  travels: boolean;
  /** The kinds of lesson they offer. */
  kinds: string[];
  specialities: string[];
  /** "from $65", or null without rates. */
  from: string | null;
  thisWeek: string[];
  nextWeek: string[];
  latitude: number | null;
  longitude: number | null;
  photoId: string | null;
  pgaVerified: boolean;
  sample: boolean;
}

/** `courseAreas` is each BookOn course's area, by slug. */
export function directoryCoach(
  coach: LiveCoach,
  now: Date,
  courseAreas: Map<string, string | null> = new Map(),
): DirectoryCoach {
  const weeks = coachWeeks(coach, now);
  const from = fromPriceCents(coach.profile);
  const { profile } = coach;
  const areas = new Set<string>([profile.area, ...(profile.travel?.areas ?? [])]);
  for (const place of profile.places) {
    const area = place.courseSlug ? courseAreas.get(place.courseSlug) : null;
    if (area) areas.add(area);
  }
  return {
    slug: coach.slug,
    name: coach.profile.name,
    headline: coach.profile.headline,
    suburb: coach.profile.suburb,
    area: coach.profile.area,
    areaName: areaName(coach.profile.area),
    areas: [...areas].filter(Boolean),
    travels: Boolean(profile.travel && profile.travel.areas.length > 0),
    kinds: [...new Set(profile.rates.map(guessLessonKind))],
    specialities: coach.profile.specialities,
    from: from === null ? null : `from ${formatPrice(from)}`,
    thisWeek: weeks.thisWeek.map(dayLabel),
    nextWeek: weeks.nextWeek.map(dayLabel),
    latitude: coach.latitude,
    longitude: coach.longitude,
    photoId: coach.photoId,
    pgaVerified: coach.pgaVerified,
    sample: coach.sample,
  };
}
