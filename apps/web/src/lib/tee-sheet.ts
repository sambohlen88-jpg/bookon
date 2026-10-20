import { addPerthDays, type WeatherHour } from "@bookon/core";
import { DAY_PARTS, type CourseResult, type DayPart, type ResultTeeTime } from "@bookon/db";
import { perthClock } from "@/lib/coaches";

/**
 * A course's tee sheet (Milestone 17): every free time for a day, like the
 * club's own timesheet but only times with room. Full times, and rows kept
 * for members or competitions, aren't shown.
 */

/** Days shown in the day strip: about as far ahead as clubs release times. */
export const SHEET_DAYS = 14;
/** Golf groups are up to four players. */
export const GROUP_SIZE = 4;
export const SESSION_CHOICES = [30, 60, 90, 120] as const;

export interface SheetOptions {
  day: string | null;
  players: number;
  holes: 9 | 18 | null;
  part: DayPart | null;
  layout: string | null;
  /** Bays only: the session length that must fit. */
  minutes: number;
}

export function sheetOptions(
  query: Record<string, string | undefined>,
  venue: boolean,
  today: string,
): SheetOptions {
  const players = Number(query.players);
  const minutes = Number(query.minutes);
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : null;
  return {
    day: day && day >= today && day <= addPerthDays(today, SHEET_DAYS - 1) ? day : null,
    players:
      Number.isInteger(players) && players >= 1 && players <= (venue ? 6 : GROUP_SIZE)
        ? players
        : venue
          ? 2
          : 1,
    holes: query.holes === "9" ? 9 : query.holes === "18" ? 18 : null,
    part: DAY_PARTS.some((p) => p.id === query.part) ? (query.part as DayPart) : null,
    layout: query.layout?.trim() || null,
    minutes: (SESSION_CHOICES as readonly number[]).includes(minutes) ? minutes : 60,
  };
}

/** The course page with a different tee sheet choice, keeping the others. */
export function sheetHref(
  slug: string,
  current: SheetOptions & { day: string },
  change: Partial<SheetOptions>,
): string {
  const next = { ...current, ...change };
  const p = new URLSearchParams({ day: next.day! });
  p.set("players", String(next.players));
  if (next.holes) p.set("holes", String(next.holes));
  if (next.part) p.set("part", next.part);
  if (next.layout) p.set("layout", next.layout);
  if (next.minutes !== 60) p.set("minutes", String(next.minutes));
  return `/courses/${slug}?${p}#tee-sheet`;
}

export interface SheetDay {
  date: string;
  count: number;
  /** times: free times; none: checked, nothing free; not-open: not released yet; unknown: couldn't check. */
  status: "times" | "none" | "not-open" | "unknown";
}

export function sheetDays(result: CourseResult | undefined, today: string): SheetDay[] {
  return Array.from({ length: SHEET_DAYS }, (_, i) => {
    const date = addPerthDays(today, i);
    const notice = result?.notices.find((n) => n.date === date);
    const count = result?.teeTimes.filter((t) => t.playDate === date).length ?? 0;
    if (notice?.kind === "not-open") return { date, count, status: "not-open" };
    if (notice) return { date, count, status: "unknown" };
    return { date, count, status: count > 0 ? "times" : "none" };
  });
}

/** Today if it has times, otherwise the first day that does, otherwise today. */
export function defaultDay(days: SheetDay[]): string {
  return (
    days[0]?.status === "times" ? days[0] : (days.find((d) => d.status === "times") ?? days[0])
  )!.date;
}

export function dayPartOf(instant: Date): DayPart {
  const at = perthClock(instant);
  return DAY_PARTS.find((p) => at < p.until)!.id;
}

/** "7 am", "12 pm", "3 pm". */
export function hourLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`;
}

export interface SheetHour {
  hour: number;
  label: string;
  part: DayPart;
  /** The hour's start, for its weather. */
  startsAt: Date;
  times: ResultTeeTime[];
}

/** One day's free times, by hour, after the layout and time-of-day choices. */
export function sheetHours(
  times: ResultTeeTime[],
  day: string,
  options: Pick<SheetOptions, "layout" | "part">,
) {
  const onDay = times.filter((t) => t.playDate === day);
  const layouts = [
    ...new Set(onDay.map((t) => t.layout).filter((l): l is string => Boolean(l))),
  ].sort();
  const layout = options.layout && layouts.includes(options.layout) ? options.layout : null;
  const shown = onDay.filter(
    (t) =>
      (!layout || t.layout === layout) &&
      (!options.part || dayPartOf(t.startTime) === options.part),
  );
  const hours: SheetHour[] = [];
  for (const t of shown.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
    const hour = Number(perthClock(t.startTime).slice(0, 2));
    let group = hours.at(-1);
    if (!group || group.hour !== hour) {
      const startsAt = new Date(t.startTime);
      startsAt.setUTCMinutes(0, 0, 0);
      group = { hour, label: hourLabel(hour), part: dayPartOf(t.startTime), startsAt, times: [] };
      hours.push(group);
    }
    group.times.push(t);
  }
  return { layouts, layout, hours, total: shown.length };
}

/** Player spots for a row of four: true is free, false is taken. */
export function spots(spotsAvailable: number): boolean[] {
  const free = Math.max(0, Math.min(GROUP_SIZE, spotsAvailable));
  return Array.from({ length: GROUP_SIZE }, (_, i) => i >= GROUP_SIZE - free);
}

/** The forecast step covering an instant, if there is one. */
export function weatherAt(hours: WeatherHour[] | undefined, instant: Date): WeatherHour | null {
  if (!hours) return null;
  const t = instant.getTime();
  return (
    hours.find((h) => {
      const start = Date.parse(h.time);
      return start <= t && t < start + h.hours * 60 * 60 * 1000;
    }) ?? null
  );
}

/** The bays that appear on a day, in the venue's order ("1", "2", "10"), for the bay grid. */
export function dayBays(times: ResultTeeTime[]): string[] {
  const all = new Set(times.flatMap((t) => t.bays ?? []));
  return [...all].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
