import * as cheerio from "cheerio";
import {
  addPerthDays,
  eachPerthDate,
  parseClockTime,
  parsePriceCents,
  perthToUtc,
  type Course,
  type CourseAdapter,
  type DayAvailability,
  type TeeTime,
} from "@bookon/core";
import { PageFormatError, collapse, readConfig } from "../shared";

/**
 * MiClub public booking pages. Two page types:
 *
 * - Calendar (`ViewPublicCalendar.msp`): one row per fee group ("18 Holes",
 *   "9 Holes", "Twilight", packages) by day, each cell either "No Bookings
 *   Available" or a link to that day's timesheet.
 * - Timesheet (`ViewPublicTimesheet.msp`): one row per tee time with up to
 *   four player cells, each `cell-available` or `cell-taken`.
 */

export interface MiClubConfig {
  /** Site root, e.g. "https://bookings.collierparkgolf.com.au". */
  baseUrl: string;
  bookingResourceId: string;
  /** Overrides which fee group headings are read. Defaults to `DEFAULT_FEE_GROUP_PATTERN`. */
  feeGroupPattern?: string;
}

/**
 * Plain green fee rows only: "18 Holes", "9 Holes - Public Holiday",
 * "OLD Course 18 Holes". Skips twilight, packages and cart deals, which have
 * conditions a search result cannot show.
 */
export const DEFAULT_FEE_GROUP_PATTERN =
  "^(?:(.+?)\\s+)?(9|18)\\s*holes?(?:\\s*-\\s*public holiday)?$";

export interface CalendarCell {
  feeGroupId: string;
  heading: string;
  date: string;
  holes: 9 | 18;
  /** Course name taken from the heading, e.g. "Old Course". */
  layout: string | null;
}

export interface CalendarPage {
  /** Number of days the page covers, starting at the requested date. */
  dayCount: number;
  /** Bookable cells for fee groups that match the pattern. */
  cells: CalendarCell[];
}

export interface TimesheetRow {
  time: string;
  layout: string | null;
  spotsAvailable: number;
  priceCents: number | null;
}

export function calendarUrl(config: MiClubConfig, date: string): string {
  const url = new URL("/guests/bookings/ViewPublicCalendar.msp", config.baseUrl);
  url.searchParams.set("bookingResourceId", config.bookingResourceId);
  url.searchParams.set("selectedDate", date);
  url.searchParams.set("weekends", "false");
  return url.toString();
}

export function timesheetUrl(config: MiClubConfig, feeGroupId: string, date: string): string {
  const url = new URL("/guests/bookings/ViewPublicTimesheet.msp", config.baseUrl);
  url.searchParams.set("bookingResourceId", config.bookingResourceId);
  url.searchParams.set("selectedDate", date);
  url.searchParams.set("feeGroupId", feeGroupId);
  return url.toString();
}

export function classifyFeeGroup(
  heading: string,
  pattern = DEFAULT_FEE_GROUP_PATTERN,
): { holes: 9 | 18; layout: string | null } | null {
  const match = new RegExp(pattern, "i").exec(collapse(heading));
  if (!match) return null;
  const holes = Number(match[2]);
  if (holes !== 9 && holes !== 18) return null;
  return { holes, layout: match[1] ? titleCase(match[1]) : null };
}

/** Parse a calendar page. Dates come from each cell's timesheet link. */
export function parseCalendar(html: string, pattern?: string): CalendarPage {
  const $ = cheerio.load(html);
  const rows = $("div.feeGroupRow");
  if (rows.length === 0) {
    throw new PageFormatError("MiClub calendar has no fee group rows");
  }

  const dayCount = $(".cell-heading").length || 7;
  const cells: CalendarCell[] = [];

  rows.each((_, row) => {
    const heading = collapse($(row).find(".row-heading > h3").first().text());
    const kind = classifyFeeGroup(heading, pattern);
    if (!kind) return;

    $(row)
      .find(".items-wrapper > .cell")
      .each((_, cell) => {
        const $cell = $(cell);
        if ($cell.hasClass("cell-na")) return;
        const onclick = $cell.attr("onclick") ?? "";
        const match = /redirectToTimesheet\(\s*'(\d+)'\s*,\s*'(\d{4}-\d{2}-\d{2})'\s*\)/.exec(
          onclick,
        );
        if (!match) return;
        cells.push({ feeGroupId: match[1]!, heading, date: match[2]!, ...kind });
      });
  });

  return { dayCount, cells };
}

/** Parse a timesheet page. Rows with no free spots are dropped. */
export function parseTimesheet(html: string): TimesheetRow[] {
  const $ = cheerio.load(html);
  if ($(".teetime-day-table").length === 0 && $("div.row-time").length === 0) {
    throw new PageFormatError("MiClub timesheet has no tee time table");
  }

  const rows: TimesheetRow[] = [];
  $("div.row-time").each((_, row) => {
    const $row = $(row);
    const time = parseClockTime(collapse($row.find(".time-wrapper > h3").first().text()));
    if (!time) return;

    const spotsAvailable = $row.find(".records-wrapper .cell.cell-available").length;
    if (spotsAvailable === 0) return;

    rows.push({
      time,
      layout: cleanLayout($row.find(".time-wrapper > h4").first().text()),
      spotsAvailable,
      priceCents: adultPrice($, $row),
    });
  });
  return rows;
}

function adultPrice($: cheerio.CheerioAPI, $row: ReturnType<cheerio.CheerioAPI>): number | null {
  const prices: { label: string; cents: number | null }[] = [];
  $row.find(".fees-wrapper li").each((_, li) => {
    const priceText = $(li).find(".price").text();
    const label = collapse($(li).text().replace(priceText, ""));
    prices.push({ label, cents: parsePriceCents(priceText) });
  });
  const adult = prices.find((p) => p.cents !== null && !/concession|junior|child/i.test(p.label));
  return adult?.cents ?? null;
}

/** "Pine Lake 18 Holes" → "Pine Lake". "1st Tee" stays as is. */
function cleanLayout(text: string): string | null {
  const cleaned = collapse(text)
    .replace(/\s*\b(9|18)(\s+or\s+(9|18))?\s*holes?\b\s*$/i, "")
    .trim();
  return cleaned || null;
}

function titleCase(text: string): string {
  return collapse(text)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const miclubAdapter: CourseAdapter = {
  platform: "miclub",

  async fetchAvailability(course, range, { http }) {
    const config = readConfig<MiClubConfig>(course, ["baseUrl", "bookingResourceId"]);
    const dates = eachPerthDate(range.from, range.to);

    // The calendar shows about a week per page, so step through the range.
    const cells: CalendarCell[] = [];
    let pageStart = range.from;
    while (pageStart <= range.to) {
      const page = parseCalendar(
        await http.getText(calendarUrl(config, pageStart)),
        config.feeGroupPattern,
      );
      cells.push(...page.cells);
      pageStart = addPerthDays(pageStart, Math.max(page.dayCount, 1));
    }

    const result: DayAvailability[] = [];
    for (const date of dates) {
      const seen = new Set<string>();
      const teeTimes: TeeTime[] = [];
      for (const cell of cells.filter((c) => c.date === date)) {
        const url = timesheetUrl(config, cell.feeGroupId, date);
        for (const row of parseTimesheet(await http.getText(url))) {
          const layout = cell.layout ?? row.layout;
          const key = `${row.time}|${cell.holes}|${layout}`;
          if (seen.has(key)) continue;
          seen.add(key);
          teeTimes.push({
            courseId: course.id,
            startTime: perthToUtc(date, row.time),
            holes: cell.holes,
            layout,
            spotsAvailable: row.spotsAvailable,
            minPlayers: 1,
            priceCents: row.priceCents,
            sourceUrl: url,
            bookingUrl: url,
          });
        }
      }
      teeTimes.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      result.push({ date, teeTimes });
    }
    return result;
  },

  buildBookingUrl(course: Course, teeTime: TeeTime) {
    return teeTime.bookingUrl ?? course.bookingUrl;
  },
};
