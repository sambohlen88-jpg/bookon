import { describe, expect, it } from "vitest";
import {
  TIME_OPTIONS,
  defaultForm,
  formatFormTime,
  nearQuery,
  parseNear,
  parseSearchForm,
  quickDays,
  searchHref,
  toSearchParams,
} from "./search-form";

// 7:00 am Perth, Saturday 17 October 2026.
const morning = new Date("2026-10-16T23:00:00Z");
// 5:00 pm Perth the same day.
const evening = new Date("2026-10-17T09:00:00Z");
const slugs = ["collier-park", "hamersley"];

describe("defaultForm", () => {
  it("searches today in the morning and tomorrow late in the day", () => {
    expect(defaultForm(morning).date).toBe("2026-10-17");
    expect(defaultForm(evening).date).toBe("2026-10-18");
  });
});

describe("TIME_OPTIONS", () => {
  it("runs every half hour from 5 am to 10 pm, for late simulator sessions", () => {
    expect(TIME_OPTIONS[0]).toBe("05:00");
    expect(TIME_OPTIONS[1]).toBe("05:30");
    expect(TIME_OPTIONS.at(-1)).toBe("22:00");
  });
});

describe("parseSearchForm", () => {
  it("reads a full query", () => {
    const form = parseSearchForm(
      {
        date: "2026-10-19",
        days: "3",
        from: "06:30",
        to: "11:00",
        players: "4",
        holes: "18",
        course: ["hamersley"],
      },
      morning,
      slugs,
    );
    expect(form).toEqual({
      play: "golf",
      date: "2026-10-19",
      days: 3,
      from: "06:30",
      to: "11:00",
      players: 4,
      holes: "18",
      minutes: 60,
      courses: ["hamersley"],
      area: null,
    });
  });

  it("falls back to sensible values for anything odd", () => {
    const form = parseSearchForm(
      {
        date: "2026-10-01",
        days: "5",
        from: "nope",
        to: "03:00",
        players: "9",
        holes: "27",
        course: "wembley",
      },
      morning,
      slugs,
    );
    expect(form).toEqual({
      play: "golf",
      date: "2026-10-17",
      days: 1,
      from: "05:00",
      to: "20:00",
      players: 2,
      holes: "any",
      minutes: 60,
      courses: [],
      area: null,
    });
  });

  it("keeps the date within two weeks and puts times in order", () => {
    const form = parseSearchForm(
      { date: "2026-12-25", from: "14:00", to: "08:00" },
      morning,
      slugs,
    );
    expect(form.date).toBe("2026-10-30");
    expect([form.from, form.to]).toEqual(["08:00", "14:00"]);
  });
});

describe("toSearchParams", () => {
  it("never searches past 14 days from today", () => {
    const form = parseSearchForm({ date: "2026-10-28", days: "7" }, morning, slugs);
    expect(toSearchParams(form, morning)).toMatchObject({
      dateFrom: "2026-10-28",
      dateTo: "2026-10-30",
    });
  });

  it("maps holes and courses", () => {
    const form = parseSearchForm({ holes: "9", course: "collier-park" }, morning, slugs);
    expect(toSearchParams(form, morning)).toMatchObject({
      holes: 9,
      courseSlugs: ["collier-park"],
    });
    expect(toSearchParams(parseSearchForm({}, morning, slugs), morning)).toMatchObject({
      holes: null,
      courseSlugs: null,
    });
  });
});

describe("searchHref", () => {
  it("round-trips through parseSearchForm", () => {
    const form = parseSearchForm(
      { date: "2026-10-19", days: "7", players: "3", course: ["hamersley"] },
      morning,
      slugs,
    );
    const query = Object.fromEntries(new URL(searchHref(form), "https://x").searchParams);
    expect(parseSearchForm({ ...query, course: ["hamersley"] }, morning, slugs)).toEqual(form);
  });
});

describe("sims and ranges", () => {
  const all = ["collier-park", "hamersley", "lights-out-golf", "outtabounds-range"];
  const kinds = {
    "lights-out-golf": "simulator",
    "outtabounds-range": "range",
  } as const;

  it("reads a bays search, with up to 6 players and a session length", () => {
    const form = parseSearchForm(
      { play: "bays", players: "6", mins: "90", course: ["lights-out-golf", "hamersley"] },
      morning,
      all,
      {},
      kinds,
    );
    expect(form).toMatchObject({
      play: "bays",
      players: 6,
      minutes: 90,
      to: "22:00",
      // A golf course can't be part of a bays search.
      courses: ["lights-out-golf"],
    });
    expect(toSearchParams(form, morning)).toMatchObject({
      play: "bays",
      minutes: 90,
      holes: null,
      courseSlugs: ["lights-out-golf"],
    });
    const query = Object.fromEntries(new URL(searchHref(form), "https://x").searchParams);
    expect(query).toMatchObject({ play: "bays", mins: "90" });
    expect(query.holes).toBeUndefined();
    expect(
      parseSearchForm({ ...query, course: ["lights-out-golf"] }, morning, all, {}, kinds),
    ).toEqual(form);
  });

  it("keeps golf searches to golf courses, with at most 4 players", () => {
    const form = parseSearchForm(
      { players: "6", mins: "30", course: ["lights-out-golf"] },
      morning,
      all,
      {},
      kinds,
    );
    expect(form).toMatchObject({ play: "golf", players: 2, courses: [] });
    // No `play` or `minutes`, so saved alerts stay tee time searches.
    expect(toSearchParams(form, morning)).not.toHaveProperty("play");
  });

  it("picks only an area's venues for a bays search", () => {
    const areas = { "collier-park": "south", "outtabounds-range": "south" };
    const form = parseSearchForm({ play: "bays", area: "south" }, morning, all, areas, kinds);
    expect(form).toMatchObject({ area: "south", courses: ["outtabounds-range"] });
  });

  it("falls back to an hour for an odd session length", () => {
    expect(parseSearchForm({ play: "bays", mins: "45" }, morning, all, {}, kinds).minutes).toBe(60);
  });
});

describe("formatFormTime", () => {
  it("shows form times the way golfers read them", () => {
    expect(formatFormTime("06:30")).toMatch(/^6:30\s?am$/i);
    expect(formatFormTime("13:00")).toMatch(/^1:00\s?pm$/i);
  });
});

describe("areas", () => {
  const areas = { "collier-park": "south", hamersley: "north" };

  it("picks an area's courses, unless courses are ticked", () => {
    const south = parseSearchForm({ area: "south" }, morning, slugs, areas);
    expect(south).toMatchObject({ area: "south", courses: ["collier-park"] });
    expect(searchHref(south)).toContain("area=south");
    expect(searchHref(south)).not.toContain("course=");
    expect(toSearchParams(south, morning).courseSlugs).toEqual(["collier-park"]);

    const ticked = parseSearchForm({ area: "south", course: ["hamersley"] }, morning, slugs, areas);
    expect(ticked).toMatchObject({ area: null, courses: ["hamersley"] });
  });

  it("searches everywhere for an unknown or empty area", () => {
    expect(parseSearchForm({ area: "mars" }, morning, slugs, areas)).toMatchObject({
      area: null,
      courses: [],
    });
    expect(parseSearchForm({ area: "peel" }, morning, slugs, areas).courses).toEqual([]);
  });
});

describe("parseNear", () => {
  it("rounds the location to about a kilometre and reads the distance", () => {
    const near = parseNear({ lat: "-31.95678", lon: "115.86123", within: "20" });
    expect(near).toEqual({ latitude: -31.96, longitude: 115.86, within: 20 });
    expect(nearQuery(near!)).toBe("lat=-31.96&lon=115.86&within=20");
    expect(parseNear({ lat: "-31.95", lon: "115.86", within: "7" })?.within).toBeNull();
  });

  it("ignores locations outside WA or missing", () => {
    expect(parseNear({ lat: "51.5", lon: "-0.12" })).toBeNull();
    expect(parseNear({})).toBeNull();
  });
});

describe("quickDays", () => {
  it("offers today, tomorrow and the weekend", () => {
    // Saturday 17 October: today, tomorrow (Sunday), then next Saturday and Sunday.
    expect(quickDays(morning).map((d) => d.label)).toEqual([
      "Today",
      "Tomorrow",
      "Sat 24 Oct",
      "Sun 25 Oct",
    ]);
    // Wednesday 21 October: today, tomorrow, Sat 24 and Sun 25.
    const wednesday = new Date("2026-10-20T23:00:00Z");
    expect(quickDays(wednesday).map((d) => d.date)).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-24",
      "2026-10-25",
    ]);
  });
});
