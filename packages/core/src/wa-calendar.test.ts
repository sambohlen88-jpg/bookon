import { describe, expect, it } from "vitest";
import type { CoachRate } from "./coaching";
import { fromPriceCents } from "./coaching";
import {
  DEFAULT_WA_CALENDAR,
  dayKind,
  formatPublicHolidays,
  formatSchoolHolidays,
  parsePublicHolidays,
  parseSchoolHolidays,
  ratePriceOn,
  specialRatesLine,
} from "./wa-calendar";

const cal = DEFAULT_WA_CALENDAR;
const rate: CoachRate = {
  name: "Private lesson",
  minutes: 60,
  priceCents: 9000,
  people: "1",
  weekendCents: 10000,
  publicHolidayCents: 12000,
  schoolHolidayCents: 9500,
};

describe("dayKind", () => {
  it("knows WA public holidays, weekends and school holidays", () => {
    expect(dayKind("2026-12-25", cal)).toEqual({
      publicHoliday: "Christmas Day",
      weekend: false,
      schoolHoliday: "Summer school holidays",
    });
    expect(dayKind("2026-10-24", cal)).toEqual({
      publicHoliday: null,
      weekend: true,
      schoolHoliday: null,
    });
    expect(dayKind("2026-10-21", cal)).toEqual({
      publicHoliday: null,
      weekend: false,
      schoolHoliday: null,
    });
  });
});

describe("ratePriceOn", () => {
  it("uses a public holiday first, then a weekend, then school holidays", () => {
    // Christmas Day 2026 is a Friday in the school holidays.
    expect(ratePriceOn(rate, "2026-12-25", cal)).toEqual({ cents: 12000, kind: "public-holiday" });
    // Saturday 19 December 2026: a weekend in the school holidays.
    expect(ratePriceOn(rate, "2026-12-19", cal)).toEqual({ cents: 10000, kind: "weekend" });
    // Tuesday 22 December 2026: a school holiday weekday.
    expect(ratePriceOn(rate, "2026-12-22", cal)).toEqual({ cents: 9500, kind: "school-holiday" });
    expect(ratePriceOn(rate, "2026-10-21", cal)).toEqual({ cents: 9000, kind: "standard" });
  });

  it("falls through to the next rate when the coach left one out", () => {
    const noHoliday = { ...rate, publicHolidayCents: undefined };
    expect(ratePriceOn(noHoliday, "2026-12-25", cal)).toEqual({
      cents: 9500,
      kind: "school-holiday",
    });
    const plain = { name: "x", minutes: 60, priceCents: 9000, people: "1" as const };
    expect(ratePriceOn(plain, "2026-12-25", cal)).toEqual({ cents: 9000, kind: "standard" });
  });

  it("counts special rates in the 'from' price", () => {
    expect(fromPriceCents({ rates: [{ ...rate, schoolHolidayCents: 8000 }] })).toBe(8000);
  });
});

describe("editing the calendar as text", () => {
  it("round-trips, and points out lines it can't read", () => {
    expect(parsePublicHolidays(formatPublicHolidays(cal.publicHolidays)).list).toEqual(
      cal.publicHolidays,
    );
    expect(parseSchoolHolidays(formatSchoolHolidays(cal.schoolHolidays)).list).toEqual(
      cal.schoolHolidays,
    );
    const read = parsePublicHolidays("2028-01-01 New Year's Day\n2028-02-30 Not a day\nrubbish");
    expect(read.list).toEqual([{ date: "2028-01-01", name: "New Year's Day" }]);
    expect(read.bad).toEqual(["2028-02-30 Not a day", "rubbish"]);
    expect(parseSchoolHolidays("2028-04-20 to 2028-04-10 Backwards").bad).toHaveLength(1);
  });
});

describe("specialRatesLine", () => {
  it("lists only the special prices the coach set", () => {
    expect(specialRatesLine(rate)).toBe(
      "Weekends $100 · Public holidays $120 · School holidays $95",
    );
    expect(
      specialRatesLine({ ...rate, publicHolidayCents: undefined, schoolHolidayCents: undefined }),
    ).toBe("Weekends $100");
    expect(specialRatesLine({ name: "x", minutes: 30, priceCents: 5000, people: "1" })).toBe("");
  });
});
