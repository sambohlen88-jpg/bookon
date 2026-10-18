import { formatPerthDay, formatPerthTime, formatPrice } from "@bookon/core";
import type { SearchParams, ShareContent, SharedCourse, SharedTeeTime } from "@bookon/db";
import { EARLIEST_TIME, LATEST_TIME, formatFormTime } from "./search-form";

/** What the share sheet and the share page need. */
export interface ShareLink {
  code: string;
  url: string;
  title: string;
  text: string;
}

/** "Tee times for Sun 18 Oct", or "Tee times, Sun 18 Oct to Sat 24 Oct". */
export function shareTitle(params: SearchParams): string {
  return params.dateFrom === params.dateTo
    ? `Tee times for ${formatPerthDay(params.dateFrom)}`
    : `Tee times, ${formatPerthDay(params.dateFrom)} to ${formatPerthDay(params.dateTo)}`;
}

/** "2 players · 6:00 am to 12:00 pm · 18 holes". */
export function shareDetails(params: SearchParams): string {
  const players = `${params.players} ${params.players === 1 ? "player" : "players"}`;
  const time =
    params.timeFrom === EARLIEST_TIME && params.timeTo === LATEST_TIME
      ? "any time"
      : `${formatFormTime(params.timeFrom)} to ${formatFormTime(params.timeTo)}`;
  const holes = params.holes ? `${params.holes} holes` : "9 or 18 holes";
  return `${players} · ${time} · ${holes}`;
}

/** "$32", "from $28", or null when no prices are known. */
export function priceSummary(times: Pick<SharedTeeTime, "priceCents">[]): string | null {
  const prices = times.map((t) => t.priceCents).filter((p): p is number => p !== null);
  if (prices.length === 0) return null;
  const low = Math.min(...prices);
  return prices.every((p) => p === low) ? formatPrice(low) : `from ${formatPrice(low)}`;
}

/** A course's shared times by Perth day, in order. */
export function timesByDay(course: SharedCourse): [string, SharedTeeTime[]][] {
  const days = new Map<string, SharedTeeTime[]>();
  for (const t of course.teeTimes) days.set(t.playDate, [...(days.get(t.playDate) ?? []), t]);
  return [...days];
}

/** Times with the same start shown once, e.g. a club starting groups off two tees. */
export function distinctTimes<T extends Pick<SharedTeeTime, "startTime">>(times: T[]): T[] {
  const seen = new Set<string>();
  return times.filter((t) => !seen.has(t.startTime) && Boolean(seen.add(t.startTime)));
}

export function shareTime(t: Pick<SharedTeeTime, "startTime">): string {
  return formatPerthTime(new Date(t.startTime));
}

/** Times listed per course in the copied text, or per day on longer searches. */
const TEXT_TIMES = { oneDay: 8, perDay: 4 };

/**
 * The plain text version, for pasting into a group chat:
 *
 *   Tee times for Sat 25 Oct
 *   4 players · any time · 9 or 18 holes
 *
 *   Collier Park Golf Course: 7:10 am, 7:20 am, 8:40 am ($32)
 *   ...
 *   https://bookon.com.au/s/abc
 */
export function shareText(content: ShareContent, url: string): string {
  const multiDay = content.params.dateFrom !== content.params.dateTo;
  const lines = [shareTitle(content.params), shareDetails(content.params), ""];
  for (const course of content.courses) {
    const price = priceSummary(course.teeTimes);
    const days = timesByDay(course);
    let listed = 0;
    const parts = (multiDay ? days.slice(0, 3) : days).map(([day, times]) => {
      const distinct = distinctTimes(times);
      const some = distinct.slice(0, multiDay ? TEXT_TIMES.perDay : TEXT_TIMES.oneDay);
      // Repeats of a listed time aren't "more".
      listed += some.length + times.length - distinct.length;
      return `${multiDay ? `${formatPerthDay(day)} ` : ""}${some.map(shareTime).join(", ")}`;
    });
    const more = course.total - listed;
    lines.push(
      `${course.name}: ${parts.join("; ")}${more > 0 ? ` +${more} more` : ""}${price ? ` (${price})` : ""}`,
    );
  }
  lines.push("", url);
  return lines.join("\n");
}
