import { describe, expect, it } from "vitest";
import { formatPerthTime } from "@bookon/core";
import { FakeHttp, fixture, testCourse } from "../test-helpers";
import { PageFormatError } from "../shared";
import { classifyRate, parsePlayers, parseSearchMatrix, quick18Adapter, searchMatrixUrl } from ".";

const hamersley = fixture("quick18/hamersley-2025-10-18.html");
const springs = fixture("quick18/springs-2025-10-16.html");
const hamersleyUrl = "https://hamersley.quick18.com/teetimes/searchmatrix?teedate=20251018";

describe("searchMatrixUrl", () => {
  it("uses the teedate=YYYYMMDD form", () => {
    expect(searchMatrixUrl({ baseUrl: "https://hamersley.quick18.com" }, "2025-10-18")).toBe(
      hamersleyUrl,
    );
  });
});

describe("classifyRate", () => {
  it("keeps plain adult rates only", () => {
    expect(classifyRate("9 Holes")).toBe(9);
    expect(classifyRate("18 holes")).toBe(18);
    expect(classifyRate("9 Holes Concession")).toBeNull();
    expect(classifyRate("Twilight Unlimited Golf")).toBeNull();
  });
});

describe("parsePlayers", () => {
  it("reads the group size range", () => {
    expect(parsePlayers("1 player")).toEqual({ min: 1, max: 1 });
    expect(parsePlayers("1 or 2 players")).toEqual({ min: 1, max: 2 });
    expect(parsePlayers("1 to 4 players")).toEqual({ min: 1, max: 4 });
    expect(parsePlayers("2 to 4 players")).toEqual({ min: 2, max: 4 });
    expect(parsePlayers("")).toBeNull();
  });
});

describe("parseSearchMatrix", () => {
  it("reads Hamersley's 9 hole slots with layout, price and slot link", () => {
    const slots = parseSearchMatrix(hamersley, hamersleyUrl);
    expect(slots).toHaveLength(17);
    expect(slots[0]).toEqual({
      time: "06:07",
      date: "2025-10-18",
      holes: 9,
      layout: "Back 9 Morning",
      minPlayers: 1,
      spotsAvailable: 1,
      priceCents: 3300,
      bookingUrl:
        "https://hamersley.quick18.com/teetimes/course/1161/teetime/202510180607?psid=6547&p=0",
    });
    expect(new Set(slots.map((s) => s.layout))).toEqual(
      new Set(["Back 9 Morning", "Back 9 Afternoon", "Hamersley"]),
    );
  });

  it("keeps rate columns aligned when concession columns are skipped", () => {
    const slots = parseSearchMatrix(
      springs,
      "https://springs.quick18.com/teetimes/searchmatrix?teedate=20251016",
    );
    const at537 = slots.filter((s) => s.time === "05:37");
    expect(at537).toEqual([
      expect.objectContaining({
        holes: 18,
        priceCents: 3500,
        bookingUrl: expect.stringContaining("psid=6378"),
      }),
      expect.objectContaining({
        holes: 9,
        priceCents: 2500,
        bookingUrl: expect.stringContaining("psid=6377"),
      }),
    ]);
    expect(slots.filter((s) => s.holes === 18)).toHaveLength(43);
    expect(slots.filter((s) => s.holes === 9)).toHaveLength(64);
  });

  it("ignores the cloned sticky header in browser-saved pages", () => {
    const slots = parseSearchMatrix(springs, "https://springs.quick18.com/teetimes/searchmatrix");
    const keys = slots.map((s) => `${s.time}|${s.holes}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("treats a Quick18 page with no matrix as no times", () => {
    const html = '<form><input id="SearchForm_Date" value="10/18/2025"></form><p>No tee times</p>';
    expect(parseSearchMatrix(html, hamersleyUrl)).toEqual([]);
  });

  it("refuses a page that is not a Quick18 search page", () => {
    expect(() => parseSearchMatrix("<html>Down for maintenance</html>", hamersleyUrl)).toThrow(
      PageFormatError,
    );
  });
});

describe("quick18Adapter.fetchAvailability", () => {
  const course = testCourse({
    platform: "quick18",
    platformConfig: { baseUrl: "https://hamersley.quick18.com" },
  });

  it("requests one page per date and converts times to UTC", async () => {
    const http = new FakeHttp((url) =>
      url.searchParams.get("teedate") === "20251018" ? hamersley : undefined,
    );
    const days = await quick18Adapter.fetchAvailability(
      course,
      { from: "2025-10-18", to: "2025-10-18" },
      { http },
    );

    expect(http.requested).toEqual([hamersleyUrl]);
    const first = days[0]!.teeTimes[0]!;
    expect(first.startTime.toISOString()).toBe("2025-10-17T22:07:00.000Z");
    expect(formatPerthTime(first.startTime)).toMatch(/^6:07\s?am$/i);
    expect(quick18Adapter.buildBookingUrl(course, first)).toContain("/teetime/202510180607");
  });

  it("drops slots whose link points at a different date", async () => {
    // The Hamersley page is for 18 October, so asking for the 19th must not reuse it.
    const http = new FakeHttp(() => hamersley);
    const days = await quick18Adapter.fetchAvailability(
      course,
      { from: "2025-10-19", to: "2025-10-19" },
      { http },
    );
    expect(days).toEqual([{ date: "2025-10-19", teeTimes: [] }]);
  });

  it("falls back to the course booking page without a slot link", () => {
    const url = quick18Adapter.buildBookingUrl(course, {
      courseId: course.id,
      startTime: new Date(),
      holes: 9,
      layout: null,
      spotsAvailable: 4,
      minPlayers: 1,
      priceCents: null,
      sourceUrl: hamersleyUrl,
      bookingUrl: null,
    });
    expect(url).toBe(course.bookingUrl);
  });
});
