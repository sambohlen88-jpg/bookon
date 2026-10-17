import { describe, expect, it } from "vitest";
import {
  TIME_OPTIONS,
  defaultForm,
  formatFormTime,
  parseSearchForm,
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
  it("runs every half hour from 5 am to 8 pm", () => {
    expect(TIME_OPTIONS[0]).toBe("05:00");
    expect(TIME_OPTIONS[1]).toBe("05:30");
    expect(TIME_OPTIONS.at(-1)).toBe("20:00");
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
      date: "2026-10-19",
      days: 3,
      from: "06:30",
      to: "11:00",
      players: 4,
      holes: "18",
      courses: ["hamersley"],
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
      date: "2026-10-17",
      days: 1,
      from: "05:00",
      to: "20:00",
      players: 2,
      holes: "any",
      courses: [],
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

describe("formatFormTime", () => {
  it("shows form times the way golfers read them", () => {
    expect(formatFormTime("06:30")).toMatch(/^6:30\s?am$/i);
    expect(formatFormTime("13:00")).toMatch(/^1:00\s?pm$/i);
  });
});
