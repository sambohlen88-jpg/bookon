import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { alertValues, newAlertValues, parseAlertForm } from "./alert-form";

// 9 am Perth, Tuesday 27 October 2026.
const now = perthToUtc("2026-10-27", "09:00");
const courses = [
  { slug: "collier-park", kind: "course" as const },
  { slug: "kennedy-bay", kind: "course" as const },
  { slug: "outtabounds", kind: "simulator" as const },
];

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  return data;
}

const when = {
  date: "2026-10-31",
  days: "3",
  from: "06:00",
  to: "10:00",
  players: "2",
  holes: "18",
};

describe("parseAlertForm (Milestone 28)", () => {
  it("reads a near me alert, with the location rounded", () => {
    const { filters, problems } = parseAlertForm(
      form({ ...when, where: "near", lat: "-31.98123", lon: "115.78456", within: "50" }),
      courses,
      now,
    );
    expect(problems).toEqual([]);
    expect(filters).toEqual({
      dateFrom: "2026-10-31",
      dateTo: "2026-11-02",
      timeFrom: "06:00",
      timeTo: "10:00",
      players: 2,
      holes: 18,
      courseSlugs: null,
      near: { latitude: -31.98, longitude: 115.78, withinKm: 50 },
    });
  });

  it("reads picked courses, golf courses only", () => {
    const { filters } = parseAlertForm(
      form({ ...when, holes: "any", where: "courses", course: ["kennedy-bay", "outtabounds"] }),
      courses,
      now,
    );
    expect(filters).toMatchObject({ courseSlugs: ["kennedy-bay"], holes: null, near: null });
  });

  it("says what's missing", () => {
    expect(
      parseAlertForm(form({ ...when, where: "near", within: "30" }), courses, now).problems,
    ).toEqual(["Tap “Use my location”, or pick courses instead."]);
    expect(
      parseAlertForm(
        form({ ...when, where: "near", lat: "-31.98", lon: "115.78", within: "500" }),
        courses,
        now,
      ).problems,
    ).toEqual(["Choose how far you'll travel."]);
    expect(parseAlertForm(form({ ...when, where: "courses" }), courses, now).problems).toEqual([
      "Pick at least one course.",
    ]);
  });
});

describe("alert form values (Milestone 28)", () => {
  it("starts near me at 30 km, or at the course from the bell", () => {
    expect(newAlertValues(now, null)).toMatchObject({ where: "near", within: 30, courses: [] });
    expect(newAlertValues(now, "kennedy-bay")).toMatchObject({
      where: "courses",
      courses: ["kennedy-bay"],
    });
  });

  it("puts a saved alert back into the form", () => {
    const values = alertValues(
      {
        dateFrom: "2026-10-20",
        dateTo: "2026-10-29",
        timeFrom: "06:00",
        timeTo: "10:00",
        players: 3,
        holes: 9,
        courseSlugs: null,
        near: { latitude: -31.98, longitude: 115.78, withinKm: 75 },
      },
      now,
    );
    // Its first day had passed, so it starts today, and covers the days left.
    expect(values).toMatchObject({
      date: "2026-10-27",
      days: 3,
      holes: "9",
      where: "near",
      within: 75,
      latitude: -31.98,
    });
  });
});
