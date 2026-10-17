import { addPerthDays, formatPerthTime, perthDate, perthToUtc } from "@bookon/core";
import type { SearchParams } from "@bookon/db";

/** Longest search, counting today. SPEC section 4. */
export const MAX_DAYS_AHEAD = 14;

export const DAY_OPTIONS = [
  { value: 1, label: "Just that day" },
  { value: 3, label: "3 days" },
  { value: 7, label: "A week" },
  { value: 14, label: "2 weeks" },
] as const;

export const EARLIEST_TIME = "05:00";
export const LATEST_TIME = "20:00";

/** Every half hour from 5 am to 8 pm. */
export const TIME_OPTIONS: string[] = Array.from({ length: 31 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

export type HolesChoice = "any" | "9" | "18";

export interface SearchForm {
  date: string;
  days: number;
  from: string;
  to: string;
  players: number;
  holes: HolesChoice;
  /** Empty means every course. */
  courses: string[];
}

type Query = Record<string, string | string[] | undefined>;

/** Late in the day, default to tomorrow so the first search is not empty. */
export function defaultForm(now: Date): SearchForm {
  const today = perthDate(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Perth",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return {
    date: hour >= 16 ? addPerthDays(today, 1) : today,
    days: 1,
    from: EARLIEST_TIME,
    to: LATEST_TIME,
    players: 2,
    holes: "any",
    courses: [],
  };
}

/**
 * Read the form from the URL. Anything missing or out of range falls back to
 * a sensible value rather than an error page.
 */
export function parseSearchForm(query: Query, now: Date, knownSlugs: string[]): SearchForm {
  const defaults = defaultForm(now);
  const today = perthDate(now);
  const lastDate = addPerthDays(today, MAX_DAYS_AHEAD - 1);
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const many = (key: string) => {
    const value = query[key];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };

  let date = one("date") ?? defaults.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) date = today;
  if (date > lastDate) date = lastDate;

  const days = Number(one("days"));
  let from = TIME_OPTIONS.includes(one("from") ?? "") ? one("from")! : defaults.from;
  let to = TIME_OPTIONS.includes(one("to") ?? "") ? one("to")! : defaults.to;
  if (from > to) [from, to] = [to, from];

  const players = Number(one("players"));
  const holes = one("holes");

  return {
    date,
    days: DAY_OPTIONS.some((o) => o.value === days) ? days : defaults.days,
    from,
    to,
    players: Number.isInteger(players) && players >= 1 && players <= 4 ? players : defaults.players,
    holes: holes === "9" || holes === "18" ? holes : "any",
    courses: many("course").filter((slug) => knownSlugs.includes(slug)),
  };
}

/** The database query for a form. The range never runs past the 14 day limit. */
export function toSearchParams(form: SearchForm, now: Date): SearchParams {
  const lastDate = addPerthDays(perthDate(now), MAX_DAYS_AHEAD - 1);
  const dateTo = addPerthDays(form.date, form.days - 1);
  return {
    dateFrom: form.date,
    dateTo: dateTo > lastDate ? lastDate : dateTo,
    timeFrom: form.from,
    timeTo: form.to,
    players: form.players,
    holes: form.holes === "any" ? null : (Number(form.holes) as 9 | 18),
    courseSlugs: form.courses.length > 0 ? form.courses : null,
  };
}

/** A /search URL for a form, for "try a wider search" links. */
export function searchHref(form: SearchForm): string {
  const query = new URLSearchParams({
    date: form.date,
    days: String(form.days),
    from: form.from,
    to: form.to,
    players: String(form.players),
    holes: form.holes,
  });
  for (const slug of form.courses) query.append("course", slug);
  return `/search?${query}`;
}

/** "7:30 am" for a form time like "07:30". */
export function formatFormTime(time: string): string {
  return formatPerthTime(perthToUtc("2026-01-01", time));
}
