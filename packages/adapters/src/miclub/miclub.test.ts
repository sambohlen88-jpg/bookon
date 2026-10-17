import { describe, expect, it } from "vitest";
import { formatPerthTime, perthDate } from "@bookon/core";
import { FakeHttp, fixture, testCourse } from "../test-helpers";
import { CaptchaRequiredError, PageFormatError } from "../shared";
import {
  calendarUrl,
  classifyFeeGroup,
  cleanLayout,
  layoutForHoles,
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
    // Collier Park, October 2026: the normal rates while greens are cored.
    expect(classifyFeeGroup("18 Holes - Maintenance (Greens Coring)")).toEqual({
      holes: 18,
      layout: null,
    });
  });

  it("accepts the ways WA clubs name their standard rates", () => {
    expect(classifyFeeGroup("18 Hole Green Fees")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("18 Holes Greenfee")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("18 Holes Online Booking")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("9 Hole Online Booking")).toEqual({ holes: 9, layout: null });
    expect(classifyFeeGroup("18 Holes Weekday")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("9 Hole Midweek")).toEqual({ holes: 9, layout: null });
    expect(classifyFeeGroup("18 Holes - WALKING")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("9 Holes Walking")).toEqual({ holes: 9, layout: null });
    expect(classifyFeeGroup("18 HOLES")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("18 Hole ")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("18 Holes (carts can be added)")).toEqual({ holes: 18, layout: null });
    expect(classifyFeeGroup("Maylands 9 Holes (carts can be added)")).toEqual({
      holes: 9,
      layout: "Maylands",
    });
  });

  it("skips twilight, packages and cart deals", () => {
    expect(classifyFeeGroup("Twilight")).toBeNull();
    expect(classifyFeeGroup("Twilight (Mon - Thu from 3pm)")).toBeNull();
    expect(classifyFeeGroup("18 Holes + Bacon & Egg Burger with Coffee")).toBeNull();
    expect(classifyFeeGroup("Weekend 9H for 4 Players with 2 Carts")).toBeNull();
    expect(classifyFeeGroup("18 Holes + Cart")).toBeNull();
    expect(classifyFeeGroup("18 Holes Weekday inc. Cart Package")).toBeNull();
    expect(classifyFeeGroup("Under 18 - 18 Holes")).toBeNull();
    expect(classifyFeeGroup("Friday 9 Hole Twilight ONLINE SPECIAL")).toBeNull();
    expect(classifyFeeGroup("Fri 18 Holes + Cart + Lunch Deal for 2 @ $85pp")).toBeNull();
    expect(classifyFeeGroup("9 Holes + Cart + Gourmet Pie before 8 am")).toBeNull();
    expect(classifyFeeGroup("18 Cart After 12pm")).toBeNull();
    expect(classifyFeeGroup("After 3pm - Unlimited Holes - Walking Only")).toBeNull();
  });

  it("takes a custom pattern", () => {
    expect(classifyFeeGroup("Twilight", "^()(9)?twilight$")).toBeNull();
    // Joondalup's 18 hole rate always includes a cart.
    expect(classifyFeeGroup("18 Holes + Cart", "^()(18|9) holes(?: \\+ cart| walking)$")).toEqual({
      holes: 18,
      layout: null,
    });
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
    expect(page.notReleased).toBe(false);
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

  it("reads a calendar with nothing released yet as no times, not an error", () => {
    // Busselton, asked for 24 October 2026 on the 17th: a real calendar page with no rates.
    const page = parseCalendar(
      fixture("miclub/live-busselton-calendar-2026-10-24-not-released.html"),
    );
    expect(page).toEqual({ dayCount: 0, notReleased: true, cells: [] });
  });

  it("stops paging once a calendar shows nothing released", async () => {
    const notReleased = fixture("miclub/live-busselton-calendar-2026-10-24-not-released.html");
    const http = new FakeHttp((url) =>
      url.pathname.endsWith("ViewPublicCalendar.msp") ? notReleased : undefined,
    );
    const days = await miclubAdapter.fetchAvailability(
      testCourse({ platformConfig: config }),
      { from: "2026-10-24", to: "2026-11-06" },
      { http },
    );
    expect(http.requested).toHaveLength(1);
    expect(days).toHaveLength(14);
    expect(days.every((d) => d.teeTimes.length === 0)).toBe(true);
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

describe("live pages recorded 17 October 2026", () => {
  const liveCalendar = fixture("miclub/live-collier-park-calendar-2026-10-17.html");
  const liveTimesheet = fixture("miclub/live-collier-park-timesheet-2026-10-18-18holes.html");

  it("reads Collier Park's greens coring rates as the normal 9 and 18 hole rates", () => {
    const page = parseCalendar(liveCalendar);
    expect(page.dayCount).toBe(6);
    expect(page.cells).toHaveLength(11);
    expect(page.cells.filter((c) => c.date === "2026-10-18")).toEqual([
      expect.objectContaining({ feeGroupId: "1501783077", holes: 18 }),
      expect.objectContaining({ feeGroupId: "1501791148", holes: 9 }),
    ]);
    // The normal 9 Holes rate comes back on the 21st alongside the coring rate.
    expect(page.cells.filter((c) => c.date === "2026-10-21").map((c) => c.heading)).toContain(
      "9 Holes",
    );
  });

  it("parses the raw server HTML of a timesheet", () => {
    const rows = parseTimesheet(liveTimesheet);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({
      time: "05:36",
      layout: "Lake (9) or Lake & Island (18)",
      spotsAvailable: 1,
      priceCents: 4000,
    });
  });

  it("uses a lone price even when its label says concession", () => {
    // Fremantle, October 2026: each row lists one fee, "Cored and Sanded Greens Concession Rate Applies".
    const rows = parseTimesheet(fixture("miclub/live-fremantle-timesheet-2026-10-18-9holes.html"));
    expect(rows[0]).toMatchObject({ time: "06:30", priceCents: 2050 });
    // Late rows carry the twilight version of the same lone rate.
    expect(new Set(rows.map((r) => r.priceCents))).toEqual(new Set([2050, 1600]));
  });

  it("prices twilight rows at the twilight fee", () => {
    // Dunsborough Lakes: twilight rows list only "$39 TWILIGHT FEE" and a junior fee.
    const rows = parseTimesheet(
      fixture("miclub/live-dunsborough-timesheet-2026-10-18-twilight.html"),
    );
    expect(rows.every((r) => r.priceCents !== null)).toBe(true);
    expect(rows.some((r) => r.priceCents === 3900)).toBe(true);
  });

  it("skips rows set aside for a competition", () => {
    const html = `<div class="teetime-day-table">
      <div class="row row-time"><div class="time-wrapper"><h3>07:00 am</h3><h4>9 Hole Ladies Comp</h4></div>
        <div class="records-wrapper"><div class="cell cell-available"></div></div></div>
      <div class="row row-time"><div class="time-wrapper"><h3>07:10 am</h3><h4>1st Tee</h4></div>
        <div class="records-wrapper"><div class="cell cell-available"></div></div></div></div>`;
    expect(parseTimesheet(html).map((r) => r.time)).toEqual(["07:10"]);
  });

  it("reads prices from a pop-up fee list", () => {
    // Rockingham lists fees in a popover: Adult $30, Pensioner $27.50, Twilight $25, Weekday Child $12.
    const rows = parseTimesheet(
      fixture("miclub/live-rockingham-timesheet-2026-10-19-popover-fees.html"),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.priceCents === 3000)).toBe(true);
  });

  it("stops at a calendar that puts timesheets behind a CAPTCHA", () => {
    expect(() =>
      parseCalendar(fixture("miclub/live-wembley-calendar-2026-10-17-captcha.html")),
    ).toThrow(CaptchaRequiredError);
  });

  it("never requests a timesheet when the calendar needs a CAPTCHA", async () => {
    const http = new FakeHttp(() =>
      fixture("miclub/live-wembley-calendar-2026-10-17-captcha.html"),
    );
    const wembley = testCourse({
      platformConfig: { baseUrl: "https://www.wembleygolf.com.au", bookingResourceId: "3000000" },
    });
    await expect(
      miclubAdapter.fetchAvailability(wembley, { from: "2026-10-19", to: "2026-10-19" }, { http }),
    ).rejects.toThrow(CaptchaRequiredError);
    expect(http.requested).toHaveLength(1);
  });

  it("names the nines that match the holes booked", async () => {
    const http = new FakeHttp((url) =>
      url.pathname.endsWith("ViewPublicCalendar.msp")
        ? liveCalendar
        : url.searchParams.get("feeGroupId") === "1501783077"
          ? liveTimesheet
          : undefined,
    );
    const course = testCourse({
      platformConfig: { ...config, feeGroupPattern: "^()(18)\\s*holes( - .*)?$" },
    });
    const [day] = await miclubAdapter.fetchAvailability(
      course,
      { from: "2026-10-18", to: "2026-10-18" },
      { http },
    );
    expect(day!.teeTimes[0]).toMatchObject({
      holes: 18,
      layout: "Lake & Island",
      priceCents: 4000,
    });
  });
});

describe("layoutForHoles", () => {
  it("picks the 9 or 18 hole name from a combined label", () => {
    expect(layoutForHoles("Lake (9) or Lake & Island (18)", 9)).toBe("Lake");
    expect(layoutForHoles("Island (9) or Island & Pines(18)", 18)).toBe("Island & Pines");
    expect(layoutForHoles("Island (9) Island & Pines (18)", 18)).toBe("Island & Pines");
    expect(layoutForHoles("1st Tee", 18)).toBe("1st Tee");
    expect(layoutForHoles(null, 9)).toBeNull();
  });
});

describe("cleanLayout", () => {
  it("drops the hole count clubs type after the course name", () => {
    expect(cleanLayout("Pine Lake 18 Holes")).toBe("Pine Lake");
    expect(cleanLayout("Pines 9 Holes ONLY")).toBe("Pines");
    expect(cleanLayout("Pines 9 ONLY")).toBe("Pines");
    expect(cleanLayout("Lake Island 9 or 18 holes")).toBe("Lake Island");
    expect(cleanLayout("Back 9")).toBe("Back 9");
    expect(cleanLayout("1st Tee")).toBe("1st Tee");
    expect(cleanLayout("1st TEE 18 HOLE SOCIAL PLAY")).toBe("1st Tee");
    expect(cleanLayout("Monday 10th tee")).toBe("10th Tee");
    expect(cleanLayout("Twilight After 3PM 10th Tee")).toBe("10th Tee");
    expect(cleanLayout("2nd Tee - Front Nine")).toBe("2nd Tee");
    expect(cleanLayout("No 1 Tee")).toBe("1st Tee");
    expect(cleanLayout("No 10 Tee")).toBe("10th Tee");
    expect(cleanLayout("Twilight 10th")).toBe("10th Tee");
    expect(cleanLayout("Social Play")).toBe("Social Play");
    expect(cleanLayout("  ")).toBeNull();
  });
});
