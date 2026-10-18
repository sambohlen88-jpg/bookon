import { describe, expect, it } from "vitest";
import { formatPerthTime } from "@bookon/core";
import { FakeHttp, fixture, testCourse } from "../test-helpers";
import { ConfigError, PageFormatError } from "../shared";
import {
  freeBays,
  hoursOn,
  parseBookings,
  parseGroupPage,
  rulePasses,
  ygbAdapter,
  ygbBookingsUrl,
  ygbConfig,
  ygbGroupUrl,
  type YgbConfig,
} from ".";

// The pages were saved on Sunday 18 October 2026, just before 9 pm Perth time,
// and the bookings are for Monday the 19th.
const now = new Date("2026-10-18T12:59:00Z");
const monday = "2026-10-19";

const venues = {
  simulators: { venue: "outta-bounds", group: "simulators" },
  range: { venue: "outta-bounds", group: "bays" },
  albatross: { venue: "albatross-lounge", group: "bays", bays: ["1", "2"] },
  elevate: { venue: "elevate-golf", group: "bays" },
  lightsOut: { venue: "lights-out-golf", group: "bays" },
} satisfies Record<string, YgbConfig>;

const pages = {
  simulators: "outta-bounds-simulators-2026-10-18.html",
  range: "outta-bounds-bays-2026-10-18.html",
  albatross: "albatross-lounge-bays-2026-10-18.html",
  elevate: "elevate-golf-bays-2026-10-18.html",
  lightsOut: "lights-out-golf-bays-2026-10-18.html",
};

function page(name: keyof typeof venues) {
  return parseGroupPage(fixture(`ygb/${pages[name]}`), venues[name]);
}

function bookings(venue: string) {
  return parseBookings(fixture(`ygb/${venue}-bookings-${monday}.json`));
}

function free(name: keyof typeof venues) {
  return freeBays(page(name), bookings(venues[name].venue), "c1", monday, now, "https://book");
}

/** Bays free at a Perth time ("9:00 am"), by label. */
function at(times: ReturnType<typeof freeBays>, time: string) {
  return times.filter((t) => formatPerthTime(t.startTime).replace(/\s/g, " ") === time);
}

describe("ygbConfig", () => {
  it("needs a venue and group", () => {
    expect(
      ygbConfig(testCourse({ platform: "ygb", platformConfig: { venue: "a", group: "b" } })),
    ).toEqual({ venue: "a", group: "b" });
    expect(
      ygbConfig(
        testCourse({ platform: "ygb", platformConfig: { venue: "a", group: "b", bays: [1, "2"] } }),
      ),
    ).toEqual({ venue: "a", group: "b", bays: ["1", "2"] });
    expect(() => ygbConfig(testCourse({ platformConfig: { venue: "a" } }))).toThrow(ConfigError);
  });

  it("builds the group page and bookings links", () => {
    expect(ygbGroupUrl(venues.simulators)).toBe(
      "https://yourgolfbooking.com/venues/outta-bounds/booking/simulators",
    );
    const url = new URL(ygbBookingsUrl("outta-bounds", monday));
    expect(url.origin + url.pathname).toBe(
      "https://api.yourgolfbooking.com/venue/outta-bounds/bookings/public",
    );
    expect(url.searchParams.get("start_gte")).toBe("2026-10-19T00:00:00+08:00");
    expect(url.searchParams.get("start_lte")).toBe("2026-10-19T23:59:59+08:00");
  });
});

describe("parseGroupPage", () => {
  it("reads the venue, bays and public session options", () => {
    const sims = page("simulators");
    expect(sims.venueName).toMatch(/outta ?bounds/i);
    expect(sims.timezone).toMatch(/^Australia\//);
    expect(sims.slotMinutes).toBe(30);
    expect(sims.maxPlayers).toBe(6);
    expect(sims.bays.map((b) => b.ref)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
      "s8",
      "s9",
    ]);
    for (const option of sims.options.values()) expect(option.minutes.length).toBeGreaterThan(0);
  });

  it("leaves out member vouchers, coaching, darts and pool", () => {
    const names = [...page("lightsOut").options.values()].map((o) => o.name);
    expect(names).toEqual(["Public Rate (7am-9pm)"]);
    const albatross = [...page("albatross").options.values()].map((o) => o.name);
    expect(albatross).toContain("NON MEMBER SIM HIRE (Over 18 years only)");
    expect(albatross.some((n) => /darts|pool/i.test(n))).toBe(false);
  });

  it("keeps only the configured bays", () => {
    expect(page("albatross").bays.map((b) => b.ref)).toEqual(["1", "2"]);
  });

  it("refuses a page that isn't a Your Golf Booking page", () => {
    expect(() => parseGroupPage("<html><body>Hello</body></html>", venues.simulators)).toThrow(
      PageFormatError,
    );
  });

  it("refuses a group the page doesn't have", () => {
    expect(() =>
      parseGroupPage(fixture(`ygb/${pages.simulators}`), {
        venue: "outta-bounds",
        group: "golf-lessons",
      }),
    ).toThrow(PageFormatError);
  });

  it("refuses configured bays that aren't bookable", () => {
    expect(() =>
      parseGroupPage(fixture(`ygb/${pages.albatross}`), { ...venues.albatross, bays: ["1", "99"] }),
    ).toThrow(PageFormatError);
  });

  it("refuses a venue that isn't on Perth time", () => {
    const html = fixture(`ygb/${pages.lightsOut}`).replace(
      /"timezone":"Australia\/(Perth|West)"/,
      '"timezone":"Australia/Sydney"',
    );
    expect(() => parseGroupPage(html, venues.lightsOut)).toThrow(/Perth time/);
  });
});

describe("hoursOn", () => {
  const outta =
    "Mo 09:00-21:00 open;Fr 09:00-23:00 open;Su 09:00-21:00 open;2025 Dec 24 09:00-18:00 open;2025 Dec 25 off";

  it("reads weekday hours", () => {
    expect(hoursOn(outta, "2026-10-19")).toEqual([{ from: 540, to: 1260 }]);
    expect(hoursOn(outta, "2026-10-23")).toEqual([{ from: 540, to: 1380 }]);
    // Tuesday has no rule: closed.
    expect(hoursOn(outta, "2026-10-20")).toEqual([]);
  });

  it("lets a date's own rule replace its weekday's", () => {
    expect(hoursOn(outta, "2025-12-24")).toEqual([{ from: 540, to: 1080 }]);
    expect(hoursOn(outta, "2025-12-25")).toEqual([]);
  });

  it("reads date ranges, day ranges, all-day and several spans", () => {
    const text =
      "Mo-Fr 10:00-12:00,13:00-17:00 open;Sa open;2025 Dec 29-2025 Dec 30 12:00-20:00 open";
    expect(hoursOn(text, "2026-10-21")).toEqual([
      { from: 600, to: 720 },
      { from: 780, to: 1020 },
    ]);
    expect(hoursOn(text, "2026-10-24")).toEqual([{ from: 0, to: 1440 }]);
    expect(hoursOn(text, "2026-10-25")).toEqual([]);
    expect(hoursOn(text, "2025-12-30")).toEqual([{ from: 720, to: 1200 }]);
    // The date range ends, and Wednesday's hours apply again.
    expect(hoursOn(text, "2025-12-31")).toHaveLength(2);
  });

  it("cuts hours past midnight at midnight", () => {
    expect(hoursOn("Sa 18:00-02:00 open", "2026-10-24")).toEqual([{ from: 1080, to: 1440 }]);
  });

  it("refuses rules it doesn't understand", () => {
    expect(() => hoursOn("Mo sunrise-sunset", monday)).toThrow(PageFormatError);
    expect(() => hoursOn("PH off", monday)).toThrow(PageFormatError);
  });
});

describe("rulePasses", () => {
  const start = new Date("2026-10-19T01:00:00Z"); // 9:00 am Monday, Perth
  const when = { date: monday, minute: 540, start, now };
  const monMorning = [{ day: "MON", fromTime: "08:00:00.000", toTime: "12:00:00.000" }];

  it("checks days and times", () => {
    const rule = { __component: "restriction.requires-day-of-week-times", times: monMorning };
    expect(rulePasses(rule, when)).toBe(true);
    expect(rulePasses(rule, { ...when, minute: 720 })).toBe(false);
    expect(
      rulePasses(
        { __component: "restriction.not-requires-day-of-week-times", times: monMorning },
        when,
      ),
    ).toBe(false);
  });

  it("checks dates", () => {
    const rule = { __component: "restriction.not-requires-date", dates: [monday] };
    expect(rulePasses(rule, when)).toBe(false);
    expect(rulePasses({ ...rule, fromTime: "12:00" }, when)).toBe(true);
  });

  it("checks how far ahead it can be booked", () => {
    const rule = {
      __component: "restriction.max-book-ahead",
      maxBookAheadValue: 6,
      maxBookAheadUnit: "hour",
    };
    expect(rulePasses(rule, when)).toBe(false);
    expect(rulePasses({ ...rule, maxBookAheadValue: 1, maxBookAheadUnit: "day" }, when)).toBe(true);
  });

  it("books as a member of the public, and never guesses at a new rule", () => {
    expect(rulePasses({ __component: "restriction.requires-perk" }, when)).toBe(false);
    expect(rulePasses({ __component: "restriction.not-requires-perk" }, when)).toBe(true);
    expect(rulePasses({ __component: "restriction.something-new" }, when)).toBe(false);
  });
});

describe("parseBookings", () => {
  it("reads bay and times only", () => {
    const list = bookings("outta-bounds");
    expect(list).toHaveLength(39);
    expect(Object.keys(list[0]!).sort()).toEqual(["bayId", "end", "start", "status"]);
  });

  it("refuses anything that isn't a list of bookings", () => {
    expect(() => parseBookings("<html>")).toThrow(PageFormatError);
    expect(() => parseBookings("{}")).toThrow(PageFormatError);
    expect(() => parseBookings('[{"start":"x"}]')).toThrow(PageFormatError);
  });
});

describe("freeBays", () => {
  it("matches OuttaBounds' simulators at 9 am Monday: SIM 1 and SIM 9 taken", () => {
    const nine = at(free("simulators"), "9:00 am");
    expect(nine.map((t) => t.bay)).toEqual(["s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
    expect(nine[0]).toMatchObject({
      courseId: "c1",
      holes: 0,
      layout: null,
      durations: [60, 90, 120],
      spotsAvailable: 6,
      // The 2 to 6 player price, not the single player deal ($25).
      priceCents: 4000,
      bookingUrl: "https://book",
    });
    expect(nine[0]!.startTime.toISOString()).toBe("2026-10-19T01:00:00.000Z");
  });

  it("only offers sessions that end by closing time", () => {
    const times = free("simulators");
    const last = at(times, "8:00 pm");
    expect(last.length).toBeGreaterThan(0);
    for (const t of last) expect(t.durations).toEqual([60]);
    expect(at(times, "8:30 pm")).toEqual([]);
  });

  it("shows no price when it depends on the players", () => {
    const nine = at(free("range"), "9:00 am");
    expect(nine).toHaveLength(18);
    expect(nine.every((t) => t.priceCents === null)).toBe(true);
    // Bay 8 is booked from 9:30, so only half an hour is free.
    expect(nine.find((t) => t.bay === "8")!.durations).toEqual([30]);
  });

  it("finds Albatross closed on Mondays", () => {
    expect(free("albatross")).toEqual([]);
  });

  it("follows Elevate's Monday hours", () => {
    const times = free("elevate");
    expect(formatPerthTime(times[0]!.startTime)).toMatch(/^11:00\s?am$/);
    expect(at(times, "11:00 am")).toHaveLength(4);
    expect(at(times, "7:30 pm")).toEqual([]);
  });

  it("only closes a bay for its closed times, like the booking page", () => {
    // Bay 2 has weekday "open 5 pm to 9 pm" ranges, but no closed ones, and no booking
    // until 5 pm. The booking page offers it from 7 am.
    expect(at(free("lightsOut"), "7:00 am").map((t) => t.bay)).toEqual(["1", "2", "3", "4"]);
  });

  it("follows Lights Out's public rate from 7 am to 9 pm at $65 an hour", () => {
    const times = free("lightsOut");
    expect(formatPerthTime(times[0]!.startTime)).toMatch(/^7:00\s?am$/);
    expect(at(times, "7:00 am").every((t) => t.priceCents === 6500)).toBe(true);
    expect(at(times, "9:00 pm")).toEqual([]);
    expect(at(times, "8:30 pm").every((t) => t.durations!.join() === "30")).toBe(true);
  });

  it("leaves out starts that have passed", () => {
    const later = new Date("2026-10-19T04:00:00Z"); // noon Monday
    const times = freeBays(page("simulators"), bookings("outta-bounds"), "c1", monday, later, "u");
    expect(times.every((t) => t.startTime > later)).toBe(true);
    expect(formatPerthTime(times[0]!.startTime)).toMatch(/^12:30\s?pm$/);
  });
});

describe("ygbAdapter.fetchAvailability", () => {
  const course = testCourse({ platform: "ygb", platformConfig: venues.simulators });

  it("reads the group page once and each open day's bookings", async () => {
    const http = new FakeHttp((url) => {
      if (url.pathname === "/venues/outta-bounds/booking/simulators")
        return fixture(`ygb/${pages.simulators}`);
      if (url.pathname.endsWith("/bookings/public"))
        return url.searchParams.get("start_gte")!.startsWith(monday)
          ? fixture(`ygb/outta-bounds-bookings-${monday}.json`)
          : "[]";
      return undefined;
    });
    const days = await ygbAdapter.fetchAvailability(
      course,
      { from: "2026-10-18", to: "2026-10-20" },
      { http, now },
    );
    expect(days.map((d) => d.date)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20"]);
    // Sunday is over by 9 pm, so nothing is left that night.
    expect(days[0]!.teeTimes).toEqual([]);
    expect(at(days[1]!.teeTimes, "9:00 am")).toHaveLength(7);
    expect(http.requested.filter((u) => u.includes("/booking/"))).toHaveLength(1);
    expect(http.requested.filter((u) => u.includes("/bookings/public"))).toHaveLength(3);
    expect(ygbAdapter.buildBookingUrl(course, days[1]!.teeTimes[0]!)).toBe(
      ygbGroupUrl(venues.simulators),
    );
  });

  it("doesn't ask for bookings on a closed day", async () => {
    const http = new FakeHttp((url) =>
      url.pathname.includes("/booking/") ? fixture(`ygb/${pages.albatross}`) : undefined,
    );
    const days = await ygbAdapter.fetchAvailability(
      testCourse({ platform: "ygb", platformConfig: venues.albatross }),
      { from: monday, to: monday },
      { http, now },
    );
    expect(days).toEqual([{ date: monday, teeTimes: [] }]);
    expect(http.requested).toHaveLength(1);
  });
});
