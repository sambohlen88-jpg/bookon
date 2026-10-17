import { describe, expect, it } from "vitest";
import { eachPerthDate, formatPerthTime, perthDate, perthToUtc } from "./time";

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
