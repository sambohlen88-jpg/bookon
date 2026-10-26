/**
 * Golf coaches (Milestone 12): what a coach's profile holds, and the sums
 * the Coaches pages do with it. No server-only imports, so pages in the
 * browser can use it too (`@bookon/core/coaching`).
 */
import { addPerthDays } from "./time";

export const SPECIALITIES = [
  { id: "all-round", name: "All-round" },
  { id: "beginners", name: "Beginners" },
  { id: "juniors", name: "Juniors" },
  { id: "womens", name: "Women's golf" },
  { id: "seniors", name: "Seniors" },
  { id: "short-game", name: "Short game" },
  { id: "putting", name: "Putting" },
  { id: "driving", name: "Driving" },
  { id: "course-management", name: "Course management" },
  { id: "club-fitting", name: "Club fitting" },
] as const;

export type SpecialityId = (typeof SPECIALITIES)[number]["id"];

export function isSpecialityId(value: unknown): value is SpecialityId {
  return SPECIALITIES.some((s) => s.id === value);
}

export function specialityName(id: string): string {
  return SPECIALITIES.find((s) => s.id === id)?.name ?? id;
}

/** Monday first, as coaches think about their week. Index 0 is Monday (day 1). */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Kinds of lesson (Milestone 26), shown as a label and used to filter Find a coach. */
export const LESSON_KINDS = [
  { id: "private", name: "Private lesson" },
  { id: "playing", name: "Playing lesson" },
  { id: "short-game", name: "Short game and putting" },
  { id: "junior", name: "Junior lesson" },
  { id: "simulator", name: "Simulator or indoor" },
  { id: "video", name: "Video analysis" },
  { id: "club-fitting", name: "Club fitting" },
  { id: "group-clinic", name: "Group clinic" },
  { id: "other", name: "Other" },
] as const;
export type LessonKind = (typeof LESSON_KINDS)[number]["id"];

export function isLessonKind(value: unknown): value is LessonKind {
  return LESSON_KINDS.some((k) => k.id === value);
}

export function lessonKindName(id: string | undefined): string | null {
  return LESSON_KINDS.find((k) => k.id === id)?.name ?? null;
}

/** A best guess at a lesson's kind from its name, for lessons saved before kinds existed. */
export function guessLessonKind(rate: Pick<CoachRate, "name" | "people" | "kind">): LessonKind {
  if (rate.kind) return rate.kind;
  const name = rate.name.toLowerCase();
  const guesses: [RegExp, LessonKind][] = [
    [/junior|kids|child/, "junior"],
    [/playing|on.course|holes?\b/, "playing"],
    [/short game|putt|chip|bunker|pitch/, "short-game"],
    [/sim|indoor|studio/, "simulator"],
    [/video|analysis|trackman/, "video"],
    [/fitting/, "club-fitting"],
    [/clinic|group/, "group-clinic"],
  ];
  const found = guesses.find(([pattern]) => pattern.test(name));
  if (found) return found[1];
  return rate.people === "group" ? "group-clinic" : "private";
}

/** The most places and lessons a coach can list (Milestone 26). */
export const MAX_COACH_PLACES = 10;
export const MAX_COACH_LESSONS = 12;

/** A lesson's "place" meaning wherever the golfer chooses, when the coach travels. */
export const PLAYER_CHOICE = "player";

export interface CoachRate {
  /** e.g. "Private lesson" or "9 hole playing lesson". */
  name: string;
  /** What kind of lesson it is (Milestone 26). */
  kind?: LessonKind;
  /**
   * Where it's taught (Milestone 26): place keys (see placeKey), and
   * PLAYER_CHOICE when the coach travels to the golfer. Left out: everywhere.
   */
  at?: string[];
  minutes: number;
  priceCents: number;
  /** "1" for one person, "2" for two, "group" for a clinic priced per person. */
  people: "1" | "2" | "group";
  /** Special rates (Milestone 19), each optional: the normal price applies when left out. */
  weekendCents?: number;
  publicHolidayCents?: number;
  schoolHolidayCents?: number;
  /** On a booking only: which price was charged, when it wasn't the standard one. */
  charged?: "weekend" | "public-holiday" | "school-holiday";
}

/** A block of usual teaching hours. Perth wall-clock times. */
export interface CoachHours {
  /** 1 = Monday … 7 = Sunday. */
  day: number;
  from: string;
  to: string;
}

/** Days away from teaching, Perth dates, inclusive. */
export interface CoachAway {
  from: string;
  to: string;
}

/** Where a coach teaches: a course or venue on BookOn, or a place of its own. */
export interface CoachPlace {
  /** A BookOn course or venue, when it's one. */
  courseSlug?: string;
  name: string;
  suburb: string;
}

/** A coach who'll come to the golfer (Milestone 26). */
export interface CoachTravel {
  /** The areas they'll travel to. */
  areas: string[];
  /** A note for golfers, like "Within 20 km of Joondalup". */
  note?: string;
}

/** A place's lasting name, for a lesson to say it's taught there. */
export function placeKey(place: CoachPlace): string {
  return place.courseSlug
    ? `course:${place.courseSlug}`
    : `${place.name}|${place.suburb}`.toLowerCase();
}

/** Where a lesson can be: the coach's places it's taught at, and whether the golfer can choose. */
export function lessonPlaces(
  profile: Pick<CoachProfile, "places" | "travel">,
  rate: Pick<CoachRate, "at">,
): { places: CoachPlace[]; playerChoice: boolean } {
  const travels = Boolean(profile.travel && profile.travel.areas.length > 0);
  if (!rate.at) return { places: profile.places, playerChoice: travels };
  const at = new Set(rate.at);
  const places = profile.places.filter((p) => at.has(placeKey(p)));
  const playerChoice = travels && at.has(PLAYER_CHOICE);
  // A lesson whose places have all gone is taught everywhere, rather than nowhere.
  if (places.length === 0 && !playerChoice)
    return { places: profile.places, playerChoice: travels };
  return { places, playerChoice };
}

export interface CoachProfile {
  name: string;
  /** One line under the name, e.g. "Short game and beginners, Osborne Park". */
  headline: string;
  bio: string;
  /** The coach says they're a PGA member. BookOn checks it separately. */
  pgaNumber?: string;
  specialities: SpecialityId[];
  rates: CoachRate[];
  hours: CoachHours[];
  away: CoachAway[];
  places: CoachPlace[];
  /** Happy to travel to the golfer (Milestone 26). */
  travel?: CoachTravel;
  /** Where they're based, for the list and areas. */
  suburb: string;
  area: string;
  contact: {
    /** Australian mobile for WhatsApp, e.g. "+61491570156". */
    whatsapp?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

/** Perth weekday of a date, 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** This week runs from today to Sunday; next week is the following Monday to Sunday. */
export function weekDates(today: string, which: "this" | "next"): string[] {
  const toSunday = 7 - isoWeekday(today);
  const start = which === "this" ? today : addPerthDays(today, toSunday + 1);
  const length = which === "this" ? toSunday + 1 : 7;
  return Array.from({ length }, (_, i) => addPerthDays(start, i));
}

/**
 * The dates the coach usually teaches, out of `dates`, leaving out days
 * away. Today only counts while a block of hours is still to come.
 */
export function teachingDates(
  profile: Pick<CoachProfile, "hours" | "away">,
  dates: string[],
  today?: string,
  nowTime?: string,
): string[] {
  return dates.filter((date) => {
    if (profile.away.some((a) => a.from <= date && date <= a.to)) return false;
    const blocks = profile.hours.filter((h) => h.day === isoWeekday(date));
    if (date === today && nowTime) return blocks.some((h) => h.to > nowTime);
    return blocks.length > 0;
  });
}

/** The cheapest lesson, for "from $65", counting special rates too. */
export function fromPriceCents(profile: Pick<CoachProfile, "rates">): number | null {
  const prices = profile.rates
    .flatMap((r) => [r.priceCents, r.weekendCents, r.publicHolidayCents, r.schoolHolidayCents])
    .filter((p): p is number => typeof p === "number" && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** "0491 570 156" or "+61 491 570 156" as "+61491570156", or null if it isn't an Australian number. */
export function normaliseAuPhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  if (/^\+61[2-478]\d{8}$/.test(digits)) return digits;
  if (/^0[2-478]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  return null;
}

/** "+61491570156" as "0491 570 156". */
export function formatAuPhone(e164: string): string {
  const local = e164.startsWith("+61") ? `0${e164.slice(3)}` : e164;
  return /^04\d{8}$/.test(local)
    ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
    : /^0\d{9}$/.test(local)
      ? `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`
      : local;
}

/** A WhatsApp chat with a first message ready to send. */
export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}

export function emailLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
