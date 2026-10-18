import {
  addPerthDays,
  formatPerthDay,
  formatPerthTime,
  isAreaId,
  perthDate,
  perthToUtc,
  type AreaId,
  type VenueKind,
} from "@bookon/core";
import type { SearchParams } from "@bookon/db";
import { WITHIN_OPTIONS, type Near } from "./near";

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
/** Simulators and ranges stay open later than the last tee time. */
export const LATEST_BAY_TIME = "22:00";

/** The latest start a search can ask for, for golf or bays. */
export function latestTime(play: PlayChoice): string {
  return play === "bays" ? LATEST_BAY_TIME : LATEST_TIME;
}

/** Every half hour from 5 am to 10 pm. */
export const TIME_OPTIONS: string[] = Array.from({ length: 35 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

export type HolesChoice = "any" | "9" | "18";
/** Golf courses, or simulator and driving range bays. */
export type PlayChoice = "golf" | "bays";

/** Bay session lengths, in minutes. */
export const SESSION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1½ hr" },
  { value: 120, label: "2 hr" },
] as const;
export const DEFAULT_SESSION = 60;
/** Sims and range bays take bigger groups than a tee time. */
export const MAX_PLAYERS = { golf: 4, bays: 6 } as const;

/** Whether a course of this kind belongs in a golf or a bays search. */
export function kindPlays(kind: VenueKind | undefined, play: PlayChoice): boolean {
  return play === "bays"
    ? kind === "simulator" || kind === "range"
    : (kind ?? "course") === "course";
}

export interface SearchForm {
  play: PlayChoice;
  date: string;
  days: number;
  from: string;
  to: string;
  players: number;
  holes: HolesChoice;
  /** Bays only: how long a session. */
  minutes: number;
  /** Empty means every course. */
  courses: string[];
  /** Courses picked by area rather than one by one. `courses` holds the area's courses. */
  area: AreaId | null;
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
    play: "golf",
    date: hour >= 16 ? addPerthDays(today, 1) : today,
    days: 1,
    from: EARLIEST_TIME,
    to: LATEST_TIME,
    players: 2,
    holes: "any",
    minutes: DEFAULT_SESSION,
    courses: [],
    area: null,
  };
}

/**
 * Read the form from the URL. Anything missing or out of range falls back to
 * a sensible value rather than an error page.
 */
export function parseSearchForm(
  query: Query,
  now: Date,
  knownSlugs: string[],
  /** Each course's area, by slug, so `area=south` can pick the South's courses. */
  areas: Record<string, string | null> = {},
  /** Each course's kind, by slug. Missing means a golf course. */
  kinds: Record<string, VenueKind> = {},
): SearchForm {
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

  const play: PlayChoice = one("play") === "bays" ? "bays" : "golf";
  // Only courses of the kind being searched: a golf search never lists a simulator.
  const slugs = knownSlugs.filter((slug) => kindPlays(kinds[slug], play));

  let date = one("date") ?? defaults.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) date = today;
  if (date > lastDate) date = lastDate;

  const days = Number(one("days"));
  let from = TIME_OPTIONS.includes(one("from") ?? "") ? one("from")! : defaults.from;
  let to = TIME_OPTIONS.includes(one("to") ?? "") ? one("to")! : latestTime(play);
  if (from > to) [from, to] = [to, from];

  const players = Number(one("players"));
  const holes = one("holes");
  const minutes = Number(one("mins"));

  return {
    play,
    date,
    days: DAY_OPTIONS.some((o) => o.value === days) ? days : defaults.days,
    from,
    to,
    players:
      Number.isInteger(players) && players >= 1 && players <= MAX_PLAYERS[play]
        ? players
        : Math.min(defaults.players, MAX_PLAYERS[play]),
    holes: holes === "9" || holes === "18" ? holes : "any",
    minutes: SESSION_OPTIONS.some((o) => o.value === minutes) ? minutes : DEFAULT_SESSION,
    ...pickCourses(
      many("course").filter((slug) => slugs.includes(slug)),
      one("area"),
      slugs,
      areas,
    ),
  };
}

/** Courses ticked one by one win; otherwise an area's courses; otherwise all. */
function pickCourses(
  ticked: string[],
  area: string | undefined,
  knownSlugs: string[],
  areas: Record<string, string | null>,
): Pick<SearchForm, "courses" | "area"> {
  if (ticked.length > 0 || !isAreaId(area)) return { courses: ticked, area: null };
  const inArea = knownSlugs.filter((slug) => areas[slug] === area);
  // An area with no courses yet searches everywhere rather than nothing.
  return inArea.length > 0 ? { courses: inArea, area } : { courses: [], area: null };
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
    holes: form.play === "golf" && form.holes !== "any" ? (Number(form.holes) as 9 | 18) : null,
    courseSlugs: form.courses.length > 0 ? form.courses : null,
    ...(form.play === "bays" ? { play: "bays" as const, minutes: form.minutes } : {}),
  };
}

/** A /search URL for a form, for "try a wider search" links. */
export function searchHref(form: SearchForm): string {
  const query = new URLSearchParams(form.play === "bays" ? { play: "bays" } : {});
  query.set("date", form.date);
  query.set("days", String(form.days));
  query.set("from", form.from);
  query.set("to", form.to);
  query.set("players", String(form.players));
  if (form.play === "bays") query.set("mins", String(form.minutes));
  else query.set("holes", form.holes);
  if (form.area) query.set("area", form.area);
  else for (const slug of form.courses) query.append("course", slug);
  return `/search?${query}`;
}

/** "7:30 am" for a form time like "07:30". */
export function formatFormTime(time: string): string {
  return formatPerthTime(perthToUtc("2026-01-01", time));
}

export { WITHIN_OPTIONS, type Near } from "./near";

/**
 * The golfer's location for a Near me search, from `lat`, `lon` and `within`.
 * It's rounded to two decimals (about a kilometre) before it reaches us, and
 * never saved: it isn't part of the search form, alerts, shares or logs.
 */
export function parseNear(query: Query): Near | null {
  const one = (key: string) => {
    const value = query[key];
    return Number(Array.isArray(value) ? value[0] : value);
  };
  const latitude = one("lat");
  const longitude = one("lon");
  // Roughly Western Australia.
  if (!(latitude >= -36 && latitude <= -13 && longitude >= 112 && longitude <= 130)) return null;
  const within = one("within");
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    within: (WITHIN_OPTIONS as readonly number[]).includes(within)
      ? (within as Near["within"])
      : null,
  };
}

/** The search's URL query with a Near me location added, for links on a Near me results page. */
export function nearQuery(near: Near): string {
  const query = new URLSearchParams({ lat: String(near.latitude), lon: String(near.longitude) });
  if (near.within) query.set("within", String(near.within));
  return query.toString();
}

/**
 * One-tap days for the search: today, tomorrow and the coming weekend.
 */
export function quickDays(now: Date): { date: string; label: string }[] {
  const today = perthDate(now);
  const days = [
    { date: today, label: "Today" },
    { date: addPerthDays(today, 1), label: "Tomorrow" },
  ];
  for (let i = 2; i <= 8 && days.length < 4; i++) {
    const date = addPerthDays(today, i);
    const weekday = formatPerthDay(date).slice(0, 3);
    if (weekday === "Sat" || weekday === "Sun") days.push({ date, label: formatPerthDay(date) });
  }
  return days;
}
