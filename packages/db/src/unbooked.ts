import { and, between, eq, gte, lte } from "drizzle-orm";
import {
  PERTH_TIME_ZONE,
  addPerthDays,
  eachPerthDate,
  isoWeekday,
  perthDate,
  perthToUtc,
} from "@bookon/core";
import type { Database } from "./client";
import { UNBOOKED_WINDOW_MINUTES } from "./queries";
import { appSettings, courses, fetchRuns, unbookedSlots } from "./schema";

/**
 * Unbooked tee times (Milestone 13): tee times still free in a check within
 * the hour before they started, for admins' Reports.
 */

export const DAY_PARTS = [
  { id: "early", name: "Before 7 am", until: "07:00" },
  { id: "morning", name: "7 to 10 am", until: "10:00" },
  { id: "midday", name: "10 am to 1 pm", until: "13:00" },
  { id: "afternoon", name: "1 to 4 pm", until: "16:00" },
  { id: "twilight", name: "4 pm on", until: "24:00" },
] as const;
export type DayPart = (typeof DAY_PARTS)[number]["id"];

/** The half hours of the golfing day used to measure how much of it was checked. */
const COVERAGE_FROM = 6 * 60;
const COVERAGE_TO = 18 * 60 + 30;

export interface UnbookedRow {
  courseId: string;
  slug: string;
  name: string;
  /** Tee times that went unbooked. */
  unbooked: number;
  /** Empty player spots across them. */
  spots: number;
  /** Price × empty spots, for the tee times with a price. */
  valueCents: number;
  /** How many of the unbooked tee times had a price. */
  priced: number;
  /** Share of the golfing day (6 am to 6:30 pm) that had a check within the hour, or null before recording began. */
  coverage: number | null;
  /** Monday first. */
  byWeekday: number[];
  byPart: Record<DayPart, number>;
}

export interface UnbookedReport {
  rows: UnbookedRow[];
  totals: Omit<UnbookedRow, "courseId" | "slug" | "name">;
  /** When BookOn started recording unbooked tee times, if it has. */
  since: Date | null;
}

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: PERTH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function dayPart(startTime: Date): DayPart {
  const time = clock.format(startTime);
  return DAY_PARTS.find((p) => time < p.until)!.id;
}

function emptyCounts() {
  return {
    unbooked: 0,
    spots: 0,
    valueCents: 0,
    priced: 0,
    byWeekday: [0, 0, 0, 0, 0, 0, 0],
    byPart: Object.fromEntries(DAY_PARTS.map((p) => [p.id, 0])) as Record<DayPart, number>,
  };
}

export async function unbookedSince(db: Database): Promise<Date | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "unbooked_since"));
  return typeof row?.value === "string" ? new Date(row.value) : null;
}

/** Unbooked tee times per live golf course between two Perth dates, inclusive. */
export async function unbookedReport(
  db: Database,
  from: string,
  to: string,
  now: Date,
): Promise<UnbookedReport> {
  const since = await unbookedSince(db);
  // One after another: the local database takes one query at a time.
  const golf = await db
    .select({ id: courses.id, slug: courses.slug, name: courses.name })
    .from(courses)
    .where(and(eq(courses.enabled, true), eq(courses.kind, "course")))
    .orderBy(courses.name);
  const slots = await db
    .select()
    .from(unbookedSlots)
    .where(between(unbookedSlots.playDate, from, to));
  const runs = await db
    .select({ courseId: fetchRuns.courseId, finishedAt: fetchRuns.finishedAt })
    .from(fetchRuns)
    .where(
      and(
        eq(fetchRuns.status, "ok"),
        gte(fetchRuns.finishedAt, perthToUtc(addPerthDays(from, -1), "00:00")),
        lte(fetchRuns.finishedAt, perthToUtc(addPerthDays(to, 1), "00:00")),
      ),
    );

  // The half-hour marks to check coverage at: after recording began and not in the future.
  const today = perthDate(now);
  const marks: Date[] = [];
  for (const date of eachPerthDate(from, to < today ? to : today)) {
    for (let m = COVERAGE_FROM; m <= COVERAGE_TO; m += 30) {
      const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const at = perthToUtc(date, hhmm);
      if (at <= now && since && at >= since) marks.push(at);
    }
  }
  const window = UNBOOKED_WINDOW_MINUTES * 60 * 1000;
  const runsFor = new Map<string, number[]>();
  for (const r of runs) {
    if (!r.finishedAt) continue;
    const list = runsFor.get(r.courseId) ?? [];
    list.push(r.finishedAt.getTime());
    runsFor.set(r.courseId, list);
  }

  const totals = emptyCounts();
  let covered = 0;
  const rows = golf.map((course) => {
    const counts = emptyCounts();
    for (const s of slots) {
      // Only since recording began, to match how much was checked.
      if (s.courseId !== course.id || (since && s.startTime < since)) continue;
      counts.unbooked++;
      counts.spots += s.spotsLeft;
      if (s.priceCents !== null) {
        counts.priced++;
        counts.valueCents += s.priceCents * s.spotsLeft;
      }
      counts.byWeekday[isoWeekday(s.playDate) - 1]!++;
      counts.byPart[dayPart(s.startTime)]++;
    }
    const finished = runsFor.get(course.id) ?? [];
    const hits = marks.filter((m) =>
      finished.some((f) => f <= m.getTime() && f >= m.getTime() - window),
    ).length;
    covered += hits;
    totals.unbooked += counts.unbooked;
    totals.spots += counts.spots;
    totals.valueCents += counts.valueCents;
    totals.priced += counts.priced;
    counts.byWeekday.forEach((n, i) => (totals.byWeekday[i]! += n));
    for (const p of DAY_PARTS) totals.byPart[p.id] += counts.byPart[p.id];
    return {
      courseId: course.id,
      slug: course.slug,
      name: course.name,
      ...counts,
      coverage: marks.length ? hits / marks.length : null,
    };
  });
  rows.sort((a, b) => b.unbooked - a.unbooked || a.name.localeCompare(b.name));
  return {
    rows,
    totals: {
      ...totals,
      coverage: marks.length && golf.length ? covered / (marks.length * golf.length) : null,
    },
    since,
  };
}
