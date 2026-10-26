/**
 * The add and edit alert form (Milestone 28): the same day, time, players and
 * holes as the search, plus where: courses near the golfer, or courses they pick.
 */
import {
  DEFAULT_NEAR_KM,
  addPerthDays,
  isNearDistance,
  perthDate,
  type NearDistance,
} from "@bookon/core";
import type { SearchParams, SearchableCourse } from "@bookon/db";
import {
  DAY_OPTIONS,
  defaultForm,
  parseNear,
  parseSearchForm,
  toSearchParams,
  type HolesChoice,
} from "./search-form";

export type AlertWhere = "near" | "courses";

/** What the form shows: a new alert's defaults, or an alert being edited. */
export interface AlertFormValues {
  date: string;
  days: number;
  from: string;
  to: string;
  players: number;
  holes: HolesChoice;
  where: AlertWhere;
  within: NearDistance;
  /** The saved location, rounded, when editing a near me alert. */
  latitude: number | null;
  longitude: number | null;
  courses: string[];
}

/** A new alert: like a fresh search, near me unless a course was chosen (the course page bell). */
export function newAlertValues(now: Date, course: string | null): AlertFormValues {
  const form = defaultForm(now);
  return {
    date: form.date,
    days: form.days,
    from: form.from,
    to: form.to,
    players: form.players,
    holes: form.holes,
    where: course ? "courses" : "near",
    within: DEFAULT_NEAR_KM,
    latitude: null,
    longitude: null,
    courses: course ? [course] : [],
  };
}

/** A saved alert, back into the form. Its first day is never before today. */
export function alertValues(filters: SearchParams, now: Date): AlertFormValues {
  const today = perthDate(now);
  const date = filters.dateFrom < today ? today : filters.dateFrom;
  let span = 1;
  while (addPerthDays(date, span - 1) < filters.dateTo) span++;
  return {
    date,
    days: DAY_OPTIONS.find((o) => o.value >= span)?.value ?? 14,
    from: filters.timeFrom,
    to: filters.timeTo,
    players: filters.players,
    holes: filters.holes ? (String(filters.holes) as HolesChoice) : "any",
    where: filters.near ? "near" : "courses",
    within:
      filters.near && isNearDistance(filters.near.withinKm)
        ? filters.near.withinKm
        : DEFAULT_NEAR_KM,
    latitude: filters.near?.latitude ?? null,
    longitude: filters.near?.longitude ?? null,
    courses: filters.courseSlugs ?? [],
  };
}

/** The alert's search, or what to fix. Golf courses only. */
export function parseAlertForm(
  form: FormData,
  courses: Pick<SearchableCourse, "slug" | "kind">[],
  now: Date,
): { filters: SearchParams | null; problems: string[] } {
  const field = (key: string) => String(form.get(key) ?? "");
  const golf = courses.filter((c) => c.kind === "course").map((c) => c.slug);
  const search = parseSearchForm(
    {
      date: field("date"),
      days: field("days"),
      from: field("from"),
      to: field("to"),
      players: field("players"),
      holes: field("holes"),
      course: form.getAll("course").map(String),
    },
    now,
    golf,
  );
  const base = toSearchParams(search, now);
  const problems: string[] = [];

  if (field("where") === "near") {
    const within = Number(field("within"));
    const near = parseNear({ lat: field("lat"), lon: field("lon") });
    if (!near) problems.push("Tap “Use my location”, or pick courses instead.");
    if (!isNearDistance(within)) problems.push("Choose how far you'll travel.");
    if (problems.length > 0) return { filters: null, problems };
    return {
      filters: {
        ...base,
        courseSlugs: null,
        near: { latitude: near!.latitude, longitude: near!.longitude, withinKm: within },
      },
      problems,
    };
  }
  if (search.courses.length === 0) problems.push("Pick at least one course.");
  return problems.length > 0
    ? { filters: null, problems }
    : { filters: { ...base, near: null }, problems };
}
