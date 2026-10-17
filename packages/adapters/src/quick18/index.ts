import * as cheerio from "cheerio";
import {
  eachPerthDate,
  parseClockTime,
  parsePriceCents,
  perthToUtc,
  type Course,
  type CourseAdapter,
  type TeeTime,
} from "@bookon/core";
import { PageFormatError, collapse, readConfig } from "../shared";

/**
 * Quick18 (Sagacity Golf) search matrix: one page per date with a row per tee
 * time and a column per rate ("9 Holes", "18 Holes Concession", "Twilight").
 * A rate cell with a Select button is bookable and links to that exact slot.
 */

export interface Quick18Config {
  /** Site root, e.g. "https://hamersley.quick18.com". */
  baseUrl: string;
}

export function searchMatrixUrl(config: Quick18Config, date: string): string {
  const url = new URL("/teetimes/searchmatrix", config.baseUrl);
  url.searchParams.set("teedate", date.replace(/-/g, ""));
  return url.toString();
}

/** Plain adult rates only: "9 Holes", "18 holes". Concession, twilight and promos are skipped. */
export function classifyRate(header: string): 9 | 18 | null {
  const match = /^(9|18)\s*holes?$/i.exec(collapse(header));
  return match ? (Number(match[1]) as 9 | 18) : null;
}

/** "1 player" → 1 to 1, "1 or 2 players" → 1 to 2, "2 to 4 players" → 2 to 4. */
export function parsePlayers(text: string): { min: number; max: number } | null {
  const numbers = collapse(text).match(/\d+/g)?.map(Number);
  if (!numbers?.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

export interface MatrixSlot {
  /** Perth "HH:mm". */
  time: string;
  /** Perth date from the slot's own link when present. */
  date: string | null;
  holes: 9 | 18;
  layout: string | null;
  minPlayers: number;
  spotsAvailable: number;
  priceCents: number | null;
  bookingUrl: string | null;
}

export function parseSearchMatrix(html: string, pageUrl: string): MatrixSlot[] {
  const $ = cheerio.load(html);
  // Browser-saved pages also carry a cloned sticky header table, so take the first.
  const table = $("table.matrixTable").first();
  if (table.length === 0) {
    if ($("#SearchForm_Date").length > 0) return []; // A real Quick18 page with no times listed.
    throw new PageFormatError("Quick18 page has no tee time matrix or search form");
  }

  // Not .map(): cheerio drops nulls from map results, which would shift the columns.
  const rates: (9 | 18 | null)[] = [];
  table.find("thead th.matrixHdrSched").each((_, th) => {
    rates.push(classifyRate($(th).text()));
  });

  const slots: MatrixSlot[] = [];
  table.find("tbody > tr").each((_, tr) => {
    const $tr = $(tr);
    const time = parseClockTime(collapse($tr.find("td.mtrxTeeTimes").text()));
    const players = parsePlayers($tr.find("td.matrixPlayers").text());
    if (!time || !players) return;
    const layout = cleanLayout($tr.find("td.mtrxCourse").text());

    $tr.find("td.matrixsched").each((index, td) => {
      const holes = rates[index];
      const $td = $(td);
      if (!holes || $td.hasClass("mtrxInactive")) return;
      const link = $td.find("a.teebutton").attr("href");
      if (!link) return;
      const bookingUrl = new URL(link, pageUrl).toString();
      slots.push({
        time,
        date: slotDate(bookingUrl),
        holes,
        layout,
        minPlayers: players.min,
        spotsAvailable: players.max,
        priceCents: parsePriceCents($td.find(".mtrxPrice").text()),
        bookingUrl,
      });
    });
  });
  return slots;
}

/** Slot links end in `/teetime/YYYYMMDDHHmm`. */
function slotDate(url: string): string | null {
  const match = /\/teetime\/(\d{4})(\d{2})(\d{2})\d{4}/.exec(url);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** "9 Holes" or "18 Holes (Double Loop)" repeat the rate, so drop them. Keep names like "Back 9 Morning". */
function cleanLayout(text: string): string | null {
  const cleaned = collapse(text);
  if (!cleaned || /^(9|18)\s*holes?\b/i.test(cleaned)) return null;
  return cleaned;
}

export const quick18Adapter: CourseAdapter = {
  platform: "quick18",

  async fetchAvailability(course, range, { http }) {
    const config = readConfig<Quick18Config>(course, ["baseUrl"]);
    const days = [];
    for (const date of eachPerthDate(range.from, range.to)) {
      const url = searchMatrixUrl(config, date);
      const slots = parseSearchMatrix(await http.getText(url), url);
      const teeTimes: TeeTime[] = slots
        .filter((slot) => (slot.date ?? date) === date)
        .map((slot) => ({
          courseId: course.id,
          startTime: perthToUtc(date, slot.time),
          holes: slot.holes,
          layout: slot.layout,
          spotsAvailable: slot.spotsAvailable,
          minPlayers: slot.minPlayers,
          priceCents: slot.priceCents,
          sourceUrl: url,
          bookingUrl: slot.bookingUrl,
        }));
      days.push({ date, teeTimes });
    }
    return days;
  },

  buildBookingUrl(course: Course, teeTime: TeeTime) {
    return teeTime.bookingUrl ?? course.bookingUrl;
  },
};
