import { isoWeekday, type CoachRate } from "./coaching";
import { formatPrice } from "./money";
import { addPerthDays, perthDate } from "./time";

/**
 * WA public holidays and school holidays (Milestone 19), for coaches'
 * special rates. These are the defaults; an admin can replace them in
 * Admin, Settings when new years are announced.
 *
 * Sources (read 20 October 2026):
 * - Public holidays 2026 and 2027: wa.gov.au, "Public holidays in Western
 *   Australia - 2026 to 2027".
 * - School terms: education.wa.edu.au, term dates for public schools. 2027
 *   dates are marked preliminary there. Holidays are the days between terms,
 *   weekends included.
 */

export interface PublicHoliday {
  date: string;
  name: string;
}

export interface SchoolHoliday {
  /** Inclusive Perth dates. */
  from: string;
  to: string;
  name: string;
}

export interface WaCalendar {
  publicHolidays: PublicHoliday[];
  schoolHolidays: SchoolHoliday[];
}

export const DEFAULT_WA_CALENDAR: WaCalendar = {
  publicHolidays: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-03-02", name: "Labour Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-05", name: "Easter Sunday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-04-27", name: "Anzac Day (extra day)" },
    { date: "2026-06-01", name: "WA Day" },
    { date: "2026-09-28", name: "King's Birthday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-26", name: "Boxing Day" },
    { date: "2026-12-28", name: "Boxing Day (extra day)" },
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-01", name: "Labour Day" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-28", name: "Easter Sunday" },
    { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-04-25", name: "Anzac Day" },
    { date: "2027-04-26", name: "Anzac Day (extra day)" },
    { date: "2027-06-07", name: "WA Day" },
    { date: "2027-09-27", name: "King's Birthday" },
    { date: "2027-12-25", name: "Christmas Day" },
    { date: "2027-12-26", name: "Boxing Day" },
    { date: "2027-12-27", name: "Christmas Day (extra day)" },
    { date: "2027-12-28", name: "Boxing Day (extra day)" },
  ],
  schoolHolidays: [
    { from: "2026-04-03", to: "2026-04-19", name: "Easter school holidays" },
    { from: "2026-07-04", to: "2026-07-19", name: "Winter school holidays" },
    { from: "2026-09-26", to: "2026-10-11", name: "Spring school holidays" },
    { from: "2026-12-18", to: "2027-01-31", name: "Summer school holidays" },
    // 2027: preliminary dates. Summer 2027-28 runs to the end of the year until 2028 is known.
    { from: "2027-04-10", to: "2027-04-25", name: "Easter school holidays" },
    { from: "2027-07-03", to: "2027-07-18", name: "Winter school holidays" },
    { from: "2027-09-25", to: "2027-10-10", name: "Spring school holidays" },
    { from: "2027-12-17", to: "2027-12-31", name: "Summer school holidays" },
  ],
};

export type RateKind = "standard" | "weekend" | "public-holiday" | "school-holiday";

export interface DayKind {
  publicHoliday: string | null;
  weekend: boolean;
  schoolHoliday: string | null;
}

export function dayKind(date: string, calendar: WaCalendar): DayKind {
  return {
    publicHoliday: calendar.publicHolidays.find((h) => h.date === date)?.name ?? null,
    weekend: isoWeekday(date) >= 6,
    schoolHoliday:
      calendar.schoolHolidays.find((h) => h.from <= date && date <= h.to)?.name ?? null,
  };
}

export const RATE_KIND_NAME: Record<RateKind, string> = {
  standard: "Standard rate",
  weekend: "Weekend rate",
  "public-holiday": "Public holiday rate",
  "school-holiday": "School holiday rate",
};

/**
 * The price of a lesson on a Perth date. When more than one special rate
 * applies, a public holiday wins, then a weekend, then school holidays (the
 * owner's rule). A special rate the coach left out falls through to the next.
 */
export function ratePriceOn(
  rate: CoachRate,
  date: string,
  calendar: WaCalendar,
): { cents: number; kind: RateKind } {
  const day = dayKind(date, calendar);
  if (day.publicHoliday && rate.publicHolidayCents)
    return { cents: rate.publicHolidayCents, kind: "public-holiday" };
  if (day.weekend && rate.weekendCents) return { cents: rate.weekendCents, kind: "weekend" };
  if (day.schoolHoliday && rate.schoolHolidayCents)
    return { cents: rate.schoolHolidayCents, kind: "school-holiday" };
  return { cents: rate.priceCents, kind: "standard" };
}

/** The same, for a lesson's start time. */
export function ratePriceAt(rate: CoachRate, start: Date, calendar: WaCalendar) {
  return ratePriceOn(rate, perthDate(start), calendar);
}

export function hasSpecialRates(rate: CoachRate): boolean {
  return Boolean(rate.weekendCents || rate.publicHolidayCents || rate.schoolHolidayCents);
}

/** "Weekends $100 · Public holidays $120", for a rate's special prices. */
export function specialRatesLine(rate: CoachRate): string {
  return [
    rate.weekendCents ? `Weekends ${formatPrice(rate.weekendCents)}` : null,
    rate.publicHolidayCents ? `Public holidays ${formatPrice(rate.publicHolidayCents)}` : null,
    rate.schoolHolidayCents ? `School holidays ${formatPrice(rate.schoolHolidayCents)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* Admin editing: one item per line. */

export function formatPublicHolidays(list: PublicHoliday[]): string {
  return list.map((h) => `${h.date} ${h.name}`).join("\n");
}

export function formatSchoolHolidays(list: SchoolHoliday[]): string {
  return list.map((h) => `${h.from} to ${h.to} ${h.name}`).join("\n");
}

const DATE = "(\\d{4}-\\d{2}-\\d{2})";

function realDate(date: string): boolean {
  return addPerthDays(date, 0) === date;
}

/** "2027-01-01 New Year's Day" lines. Returns the bad lines too, to show the admin. */
export function parsePublicHolidays(text: string): { list: PublicHoliday[]; bad: string[] } {
  const list: PublicHoliday[] = [];
  const bad: string[] = [];
  for (const line of text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = new RegExp(`^${DATE}\\s+(.{1,60})$`).exec(line);
    if (m && realDate(m[1]!)) list.push({ date: m[1]!, name: m[2]!.trim() });
    else bad.push(line);
  }
  return { list: list.sort((a, b) => a.date.localeCompare(b.date)), bad };
}

/** "2027-04-10 to 2027-04-25 Easter school holidays" lines. */
export function parseSchoolHolidays(text: string): { list: SchoolHoliday[]; bad: string[] } {
  const list: SchoolHoliday[] = [];
  const bad: string[] = [];
  for (const line of text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = new RegExp(`^${DATE}\\s+to\\s+${DATE}\\s+(.{1,60})$`).exec(line);
    if (m && realDate(m[1]!) && realDate(m[2]!) && m[1]! <= m[2]!)
      list.push({ from: m[1]!, to: m[2]!, name: m[3]!.trim() });
    else bad.push(line);
  }
  return { list: list.sort((a, b) => a.from.localeCompare(b.from)), bad };
}
