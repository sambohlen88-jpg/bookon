import { describe, expect, it } from "vitest";
import { formatPerthTime, perthDate } from "@bookon/core";
import { FakeHttp, fixture, testCourse } from "../test-helpers";
import { PageFormatError } from "../shared";
import {
  calendarUrl,
  classifyFeeGroup,
  miclubAdapter,
  parseCalendar,
  parseTimesheet,
  timesheetUrl,
} from ".";

const collierCalendar = fixture("miclub/collier-park-calendar-2025-09-27.html");
const collierTimesheet = fixture("miclub/collier-park-timesheet-2025-09-30-9holes.html");

const config = { baseUrl: "https://bookings.collierparkgolf.com.au", bookingResourceId: "3000000" };

describe("classifyFeeGroup", () => {
  it("accepts plain green fee groups", () => {
    expect(classifyFeeGroup("18 Holes")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("9 Holes - Public Holiday")).toEqual({ holes: 9, layout: null });
    expect(classifyFeeGroup("OLD Course 18 Holes")).toEqual({ holes: 18, layout: "Old Course" });
    expect(classifyFeeGroup("TUART Course 9 Holes")).toEqual({ holes: 9, layout: "Tuart Course" });
  });

  it("skips twilight, packages and cart deals", () => {
    expect(classifyFeeGroup("Twilight")).toBeNull();
    expect(classifyFeeGroup("Twilight (Mon - Thu from 3pm)")).toBeNull();
    expect(classifyFeeGroup("18 Holes + Bacon & Egg Burger with Coffee")).toBeNull();
    expect(classifyFeeGroup("Weekend 9H for 4 Players with 2 Carts")).toBeNull();
  });

  it("takes a custom pattern", () => {
    expect(classifyFeeGroup("Twilight", "^()(9)?twilight$")).toBeNull();
    expect(classifyFeeGroup("Comp 9 holes", "^(comp)\\s+(9|18)\\s*holes$")).toEqual({
      holes: 9,
      layout: "Comp",
    });
  });
});

describe("parseCalendar", () => {
  it("reads bookable 9 and 18 hole cells from the Collier Park calendar", () => {
    const page = parseCalendar(collierCalendar);
    expect(page.dayCount).toBe(6);
    expect(page.cells).toHaveLength(12);
    expect(page.cells).toContainEqual({
      feeGroupId: "1500323733",
      heading: "9 Holes",
      date: "2025-09-30",
      holes: 9,
      layout: null,
    });
    // 29 September 2025 was the King's Birthday holiday in WA.
    expect(page.cells.filter((c) => c.date === "2025-09-29").map((c) => c.heading)).toEqual([
      "18 Holes - Public Holiday",
      "9 Holes - Public Holiday",
    ]);
    expect(page.cells.some((c) => /twilight|burger|cart/i.test(c.heading))).toBe(false);
  });

  it("skips days marked Not Available", () => {
    const page = parseCalendar(fixture("miclub/fremantle-calendar-2025-09-27.html"));
    const eighteenHoleDates = page.cells.filter((c) => c.holes === 18).map((c) => c.date);
    expect(eighteenHoleDates).toEqual(["2025-09-30", "2025-10-01", "2025-10-02"]);
  });

  it("refuses a page that is not a MiClub calendar", () => {
    expect(() => parseCalendar("<html><body>Maintenance</body></html>")).toThrow(PageFormatError);
  });
});

describe("parseTimesheet", () => {
  it("reads open tee times with spots, layout and adult price", () => {
    const rows = parseTimesheet(collierTimesheet);
    expect(rows).toHaveLength(51);
    expect(rows[0]).toEqual({
      time: "06:08",
      layout: "Lake Island",
      spotsAvailable: 1,
      priceCents: 3000,
    });
    expect(rows.at(-1)).toEqual({
      time: "15:52",
      layout: "Island Pine",
      spotsAvailable: 4,
      priceCents: 2700,
    });
    expect(rows.reduce((sum, r) => sum + r.spotsAvailable, 0)).toBe(138);
  });

  it("drops fully booked rows", () => {
    const rows = parseTimesheet(collierTimesheet);
    // The 6:00 am rows in this fixture are all Taken.
    expect(rows.some((r) => r.time === "06:00")).toBe(false);
    expect(rows.every((r) => r.spotsAvailable >= 1 && r.spotsAvailable <= 4)).toBe(true);
  });

  it("refuses a page that is not a MiClub timesheet", () => {
    expect(() => parseTimesheet("<html><body>Login</body></html>")).toThrow(PageFormatError);
  });
});

describe("miclubAdapter.fetchAvailability", () => {
  const course = testCourse({
    platform: "miclub",
    platformConfig: { ...config, feeGroupPattern: "^()(9)\\s*holes$" },
  });

  function collierHttp() {
    return new FakeHttp((url) => {
      if (url.pathname.endsWith("ViewPublicCalendar.msp")) return collierCalendar;
      if (url.searchParams.get("feeGroupId") === "1500323733") return collierTimesheet;
      return undefined;
    });
  }

  it("reads the calendar, then one timesheet per bookable fee group and day", async () => {
    const http = collierHttp();
    const days = await miclubAdapter.fetchAvailability(
      course,
      { from: "2025-09-30", to: "2025-09-30" },
      { http },
    );

    expect(http.requested).toEqual([
      calendarUrl(config, "2025-09-30"),
      timesheetUrl(config, "1500323733", "2025-09-30"),
    ]);
    expect(days).toHaveLength(1);
    const [day] = days;
    expect(day!.date).toBe("2025-09-30");
    expect(day!.teeTimes).toHaveLength(51);

    const first = day!.teeTimes[0]!;
    expect(first.startTime.toISOString()).toBe("2025-09-29T22:08:00.000Z");
    expect(perthDate(first.startTime)).toBe("2025-09-30");
    expect(formatPerthTime(first.startTime)).toMatch(/^6:08\s?am$/i);
    expect(first).toMatchObject({
      holes: 9,
      layout: "Lake Island",
      spotsAvailable: 1,
      priceCents: 3000,
    });
    expect(first.bookingUrl).toBe(timesheetUrl(config, "1500323733", "2025-09-30"));
  });

  it("reports days with nothing bookable as empty rather than skipping them", async () => {
    const http = collierHttp();
    const days = await miclubAdapter.fetchAvailability(
      testCourse({ platformConfig: { ...config, feeGroupPattern: "^()(9)\\s*holes - nothing$" } }),
      { from: "2025-09-30", to: "2025-10-01" },
      { http },
    );
    expect(days).toEqual([
      { date: "2025-09-30", teeTimes: [] },
      { date: "2025-10-01", teeTimes: [] },
    ]);
  });

  it("fails the whole fetch when a timesheet cannot be read", async () => {
    const http = collierHttp();
    const defaults = testCourse({ platformConfig: config });
    await expect(
      miclubAdapter.fetchAvailability(defaults, { from: "2025-09-30", to: "2025-09-30" }, { http }),
    ).rejects.toThrow(/No fixture/);
  });

  it("pages through the calendar for ranges longer than a week", async () => {
    const http = new FakeHttp((url) =>
      url.pathname.endsWith("ViewPublicCalendar.msp") ? collierCalendar : undefined,
    );
    await miclubAdapter.fetchAvailability(
      testCourse({ platformConfig: { ...config, feeGroupPattern: "^nothing()()$" } }),
      { from: "2025-09-27", to: "2025-10-06" },
      { http },
    );
    expect(http.requested).toEqual([
      calendarUrl(config, "2025-09-27"),
      calendarUrl(config, "2025-10-03"),
    ]);
  });

  it("requires a base URL and booking resource", async () => {
    await expect(
      miclubAdapter.fetchAvailability(
        testCourse({ platformConfig: {} }),
        { from: "2025-09-30", to: "2025-09-30" },
        { http: collierHttp() },
      ),
    ).rejects.toThrow(/baseUrl is required/);
  });
});
