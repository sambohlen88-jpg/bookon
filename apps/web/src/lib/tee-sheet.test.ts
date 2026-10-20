import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import type { CourseResult, ResultTeeTime } from "@bookon/db";
import {
  dayBays,
  dayPartOf,
  defaultDay,
  sheetDays,
  sheetHours,
  sheetHref,
  sheetOptions,
  spots,
  weatherAt,
} from "./tee-sheet";

const today = "2026-10-20";
const t = (date: string, time: string, extra: Partial<ResultTeeTime> = {}): ResultTeeTime => ({
  startTime: perthToUtc(date, time),
  playDate: date,
  holes: 18,
  layout: null,
  spotsAvailable: 4,
  priceCents: 3900,
  bookingUrl: "https://club.example/book",
  ...extra,
});

describe("sheetOptions", () => {
  it("reads the choices, ignoring anything out of range", () => {
    expect(
      sheetOptions(
        { day: "2026-10-22", players: "3", holes: "9", part: "morning", layout: "Back 9" },
        false,
        today,
      ),
    ).toEqual({
      day: "2026-10-22",
      players: 3,
      holes: 9,
      part: "morning",
      layout: "Back 9",
      minutes: 60,
    });
    expect(
      sheetOptions({ day: "2026-10-01", players: "7", holes: "27", part: "night" }, false, today),
    ).toMatchObject({
      day: null,
      players: 1,
      holes: null,
      part: null,
    });
    expect(sheetOptions({ players: "6", minutes: "90" }, true, today)).toMatchObject({
      players: 6,
      minutes: 90,
    });
  });

  it("builds links that keep the other choices", () => {
    const current = {
      ...sheetOptions({ players: "2", holes: "18" }, false, today),
      day: "2026-10-21",
    };
    expect(sheetHref("collier-park", current, { part: "twilight" })).toBe(
      "/courses/collier-park?day=2026-10-21&players=2&holes=18&part=twilight#tee-sheet",
    );
  });
});

describe("sheetDays", () => {
  it("counts free times each day and marks days not released or not checked", () => {
    const result = {
      teeTimes: [t("2026-10-21", "07:00"), t("2026-10-21", "07:08")],
      notices: [
        { date: "2026-10-22", kind: "stale", lastSuccessAt: null, problem: "site-down" },
        { date: "2026-10-30", kind: "not-open", opensOn: "2026-10-23" },
      ],
    } as unknown as CourseResult;
    const days = sheetDays(result, today);
    expect(days).toHaveLength(14);
    expect(days.slice(0, 3)).toEqual([
      { date: "2026-10-20", count: 0, status: "none" },
      { date: "2026-10-21", count: 2, status: "times" },
      { date: "2026-10-22", count: 0, status: "unknown" },
    ]);
    expect(days.find((d) => d.date === "2026-10-30")?.status).toBe("not-open");
    // Nothing today, so the sheet opens on the first day with times.
    expect(defaultDay(days)).toBe("2026-10-21");
  });
});

describe("sheetHours", () => {
  const times = [
    t(today, "06:52", { layout: "Front 9" }),
    t(today, "07:00", { layout: "Back 9" }),
    t(today, "07:08", { layout: "Front 9" }),
    t(today, "15:30", { layout: "Front 9" }),
    t("2026-10-21", "07:00", { layout: "Front 9" }),
  ];

  it("groups one day's times by hour, with the course's layouts", () => {
    const sheet = sheetHours(times, today, { layout: null, part: null });
    expect(sheet.layouts).toEqual(["Back 9", "Front 9"]);
    expect(sheet.hours.map((h) => [h.label, h.part, h.times.length])).toEqual([
      ["6 am", "early", 1],
      ["7 am", "morning", 2],
      ["3 pm", "afternoon", 1],
    ]);
    expect(sheet.hours[1]!.startsAt).toEqual(perthToUtc(today, "07:00"));
  });

  it("narrows to a layout and a time of day", () => {
    const sheet = sheetHours(times, today, { layout: "Front 9", part: "morning" });
    expect(sheet.total).toBe(1);
    expect(sheet.hours[0]!.times[0]!.startTime).toEqual(perthToUtc(today, "07:08"));
    // A layout that isn't on this day is ignored rather than hiding everything.
    expect(sheetHours(times, today, { layout: "Old Course", part: null }).total).toBe(4);
  });
});

describe("helpers", () => {
  it("draw a row of four with the free spots last", () => {
    expect(spots(1)).toEqual([false, false, false, true]);
    expect(spots(4)).toEqual([true, true, true, true]);
    expect(spots(6)).toEqual([true, true, true, true]);
  });

  it("sort times into the parts of the day", () => {
    expect(dayPartOf(perthToUtc(today, "06:59"))).toBe("early");
    expect(dayPartOf(perthToUtc(today, "16:00"))).toBe("twilight");
  });

  it("find the forecast step for a time", () => {
    const hours = [
      {
        time: "2026-10-19T23:00:00Z",
        hours: 1,
        temperature: 14,
        symbol: "clearsky_day",
        rainMm: 0,
        rainChance: null,
        windKmh: 9,
      },
      {
        time: "2026-10-20T00:00:00Z",
        hours: 6,
        temperature: 19,
        symbol: "cloudy",
        rainMm: 0,
        rainChance: null,
        windKmh: 15,
      },
    ];
    expect(weatherAt(hours, perthToUtc(today, "07:00"))?.temperature).toBe(14);
    expect(weatherAt(hours, perthToUtc(today, "11:00"))?.temperature).toBe(19);
    expect(weatherAt(hours, perthToUtc(today, "20:00"))).toBeNull();
  });

  it("put bays in the venue's order", () => {
    expect(
      dayBays([t(today, "13:00", { bays: ["10", "2"] }), t(today, "13:30", { bays: ["1"] })]),
    ).toEqual(["1", "2", "10"]);
  });
});
