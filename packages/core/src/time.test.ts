import { describe, expect, it } from "vitest";
import {
  addPerthDays,
  eachPerthDate,
  formatPerthTime,
  parseClockTime,
  perthDate,
  perthToUtc,
} from "./time";

describe("perthToUtc", () => {
  it("applies the fixed +8 hour offset", () => {
    expect(perthToUtc("2026-10-17", "07:30").toISOString()).toBe("2026-10-16T23:30:00.000Z");
  });

  it("is not affected by eastern states daylight saving", () => {
    expect(perthToUtc("2026-01-15", "12:00").toISOString()).toBe("2026-01-15T04:00:00.000Z");
    expect(perthToUtc("2026-07-15", "12:00").toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => perthToUtc("17/10/2026", "07:30")).toThrow();
    expect(() => perthToUtc("2026-10-17", "7:30")).toThrow();
    expect(() => perthToUtc("2026-10-17", "24:00")).toThrow();
  });
});

describe("perthDate", () => {
  it("rolls over to the next Perth day before UTC midnight", () => {
    expect(perthDate(new Date("2026-10-17T16:30:00Z"))).toBe("2026-10-18");
  });
});

describe("formatPerthTime", () => {
  it("formats in Perth time", () => {
    expect(formatPerthTime(new Date("2026-10-16T23:40:00Z"))).toMatch(/^7:40\s?am$/i);
  });
});

describe("eachPerthDate", () => {
  it("lists dates inclusively across a month end", () => {
    expect(eachPerthDate("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("rejects reversed ranges", () => {
    expect(() => eachPerthDate("2026-10-20", "2026-10-19")).toThrow();
  });
});

describe("addPerthDays", () => {
  it("crosses month and year ends", () => {
    expect(addPerthDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addPerthDays("2026-10-17", 10)).toBe("2026-10-27");
    expect(addPerthDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("parseClockTime", () => {
  it("reads the formats clubs use", () => {
    expect(parseClockTime("6:07 AM")).toBe("06:07");
    expect(parseClockTime("06:00 am ")).toBe("06:00");
    expect(parseClockTime("12:15 pm")).toBe("12:15");
    expect(parseClockTime("12:05am")).toBe("00:05");
    expect(parseClockTime("2:30 PM")).toBe("14:30");
    expect(parseClockTime("14:30")).toBe("14:30");
  });

  it("rejects things that are not times", () => {
    expect(parseClockTime("Taken")).toBeNull();
    expect(parseClockTime("13:00 pm")).toBeNull();
    expect(parseClockTime("25:00")).toBeNull();
  });
});
