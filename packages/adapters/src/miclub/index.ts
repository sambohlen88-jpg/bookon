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
import { CaptchaRequiredError, PageFormatError, collapse, readConfig } from "../shared";

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
  /**
   * Overrides which fee group headings are read: a regex whose group 1 is the
   * layout (may be empty) and group 2 is 9 or 18. Defaults to `classifyFeeGroup`'s rules.
   */
  feeGroupPattern?: string;
}

/** A fee group heading that names 9 or 18 holes, with anything before or after. */
const HOLES_HEADING = /^(?:(.+?)\s+)?(9|18)\s*holes?\b\s*(.*)$/i;

/**
 * Words that mark a rate with conditions a search result cannot show:
 * packages, food and cart deals, twilight, junior and member rates.
 * "(carts can be added)" is fine: the cart is optional.
 */
const NOT_A_PLAIN_RATE =
  /\+|package|deal|special|lunch|meal|burger|pie\b|scooter|trike|twilight|unlimited|under\s*\d|junior|member|\bcomp\b|cart(?!s can be added)/i;

/** Day words before the hole count say when the rate applies, not which course. */
const WHEN_PREFIX = /^(mon|tue|wed|thu|fri|sat|sun|week|mid)/i;

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
  /** A real calendar with no rates at all: nothing released from this date on. */
  notReleased: boolean;
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

/**
 * Plain green fee rows: "18 Holes", "OLD Course 18 Holes", "18 Hole Green Fees",
 * "18 Holes Weekday", "9 Holes - Public Holiday", "18 Holes - Maintenance
 * (Greens Coring)", "Maylands 9 Holes (carts can be added)". Skips anything
 * matching `NOT_A_PLAIN_RATE`.
 */
export function classifyFeeGroup(
  heading: string,
  pattern?: string,
): { holes: 9 | 18; layout: string | null } | null {
  const text = collapse(heading);
  if (pattern) {
    const match = new RegExp(pattern, "i").exec(text);
    if (!match) return null;
    const holes = Number(match[2]);
    if (holes !== 9 && holes !== 18) return null;
    return { holes, layout: match[1] ? titleCase(match[1]) : null };
  }

  const match = HOLES_HEADING.exec(text);
  if (!match || NOT_A_PLAIN_RATE.test(text)) return null;
  const prefix = match[1]?.trim();
  return {
    holes: Number(match[2]) as 9 | 18,
    layout: prefix && !WHEN_PREFIX.test(prefix) ? titleCase(prefix) : null,
  };
}

/** Parse a calendar page. Dates come from each cell's timesheet link. */
export function parseCalendar(html: string, pattern?: string): CalendarPage {
  // The calendar sets this flag when timesheets sit behind reCAPTCHA. Stop here, before requesting any.
  if (/publicCaptchaEnabled\s*=\s*true\b/.test(html)) {
    throw new CaptchaRequiredError("The club requires a CAPTCHA to view timesheets");
  }
  const $ = cheerio.load(html);
  const rows = $("div.feeGroupRow");
  if (rows.length === 0) {
    // Past a club's release window the calendar page loads with no rates at all.
    if ($(".public-calendar").length > 0) return { dayCount: 0, notReleased: true, cells: [] };
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

  return { dayCount, notReleased: false, cells };
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
    // Rows set aside for a competition or members aren't for public golfers.
    const label = collapse($row.find(".time-wrapper > h4").first().text());
    if (/\b(comp|competition|pennants?|members?)\b/i.test(label)) return;

    rows.push({
      time,
      layout: cleanLayout(label),
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
  // Some clubs put the fee list in a pop-up instead: data-content="<ul><li>Adult $30.00</li>…".
  if (prices.length === 0) {
    const popup = $row.find(".fees-wrapper [data-content]").attr("data-content");
    if (popup) {
      const $popup = cheerio.load(popup);
      $popup("li").each((_, li) => {
        const text = collapse($popup(li).text());
        prices.push({ label: text.replace(/\$\s*[\d,.]+/, ""), cents: parsePriceCents(text) });
      });
    }
  }
  const priced = prices.filter((p) => p.cents !== null);
  // A twilight fee listed on a twilight row is what an adult pays then, so it counts.
  const adult = priced.find(
    (p) => !/concession|pensioner|senior|student|junior|child/i.test(p.label),
  );
  // A lone price is the rate for everyone, even when labelled e.g. "Cored Greens Concession Rate Applies".
  return adult?.cents ?? (priced.length === 1 ? priced[0]!.cents : null);
}

/**
 * Clubs label tee sheet rows by hand. Where a row names a starting tee, show
 * just that: "1st TEE 18 HOLE SOCIAL PLAY", "Monday 10th tee" and "Before 9AM
 * 1st Tee" become "1st Tee" and "10th Tee". Course names pass through, minus
 * a trailing hole count: "Pine Lake 18 Holes" → "Pine Lake", "Pines 9 ONLY" → "Pines".
 */
export function cleanLayout(text: string): string | null {
  const tee =
    /\b(1st|2nd|10th)(?:\s+tee)?\b/i.exec(text) ?? /\bno\.?\s*(1|2|10)\s+tee\b/i.exec(text);
  if (tee) return `${ordinal(tee[1]!)} Tee`;
  const cleaned = collapse(text)
    .replace(/\s*\b(9|18)(\s+or\s+(9|18))?\s*(holes?(\s+only)?|only)\s*$/i, "")
    .trim();
  return cleaned || null;
}

/**
 * "Lake (9) or Lake & Island (18)" → "Lake" for 9 holes, "Lake & Island" for 18.
 * The "or" is optional, as clubs type these by hand. Other names pass through.
 */
export function layoutForHoles(layout: string | null, holes: 9 | 18): string | null {
  const match = /^(.+?)\s*\(9\)\s*(?:or\s+)?(.+?)\s*\(18\)$/i.exec(layout ?? "");
  if (!match) return layout;
  return holes === 9 ? match[1]! : match[2]!;
}

function ordinal(tee: string): string {
  const n = tee.replace(/\D/g, "");
  return n === "1" ? "1st" : n === "2" ? "2nd" : `${n}th`;
}

function isCheaper(price: number | null, than: number | null): boolean {
  return price !== null && (than === null || price < than);
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
      if (page.notReleased) break; // Later dates won't be released either.
      pageStart = addPerthDays(pageStart, Math.max(page.dayCount, 1));
    }

    const result: DayAvailability[] = [];
    for (const date of dates) {
      // Two fee types can list the same slot (e.g. "9 Holes" and "9 Holes - Maintenance"). Keep the cheaper.
      const bySlot = new Map<string, TeeTime>();
      for (const cell of cells.filter((c) => c.date === date)) {
        const url = timesheetUrl(config, cell.feeGroupId, date);
        for (const row of parseTimesheet(await http.getText(url))) {
          const layout = cell.layout ?? layoutForHoles(row.layout, cell.holes);
          const key = `${row.time}|${cell.holes}|${layout}`;
          const existing = bySlot.get(key);
          if (existing && !isCheaper(row.priceCents, existing.priceCents)) continue;
          bySlot.set(key, {
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
      const teeTimes = [...bySlot.values()].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      );
      result.push({ date, teeTimes });
    }
    return result;
  },

  buildBookingUrl(course: Course, teeTime: TeeTime) {
    return teeTime.bookingUrl ?? course.bookingUrl;
  },
};
