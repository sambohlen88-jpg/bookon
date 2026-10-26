import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { parseGroupSessionForm } from "./group-form";

const now = perthToUtc("2026-10-20", "09:00");
const places = ["Range, Como"];

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    title: "Beginners' clinic",
    date: "2026-10-24",
    time: "14:00",
    minutes: "60",
    place: "Range, Como",
    price: "40",
    spots: "6",
    minSpots: "",
    weeks: "1",
    ...values,
  }))
    f.set(k, v);
  return f;
}

describe("parseGroupSessionForm", () => {
  it("reads a weekly session", () => {
    const { input, problems } = parseGroupSessionForm(
      form({ weeks: "3", minSpots: "3", price: "$42.50" }),
      places,
      now,
      "2026-10-20",
    );
    expect(problems).toEqual([]);
    expect(input).toMatchObject({
      title: "Beginners' clinic",
      minutes: 60,
      priceCents: 4250,
      spots: 6,
      minSpots: 3,
      starts: [
        perthToUtc("2026-10-24", "14:00"),
        perthToUtc("2026-10-31", "14:00"),
        perthToUtc("2026-11-07", "14:00"),
      ],
    });
  });

  it("lists what to fix", () => {
    const { input, problems } = parseGroupSessionForm(
      form({ title: "", date: "2026-10-19", place: "Somewhere", spots: "1", minSpots: "5" }),
      places,
      now,
      "2026-10-20",
    );
    expect(input).toBeNull();
    expect(problems).toEqual([
      'Give the session a name, like "Beginners\' clinic".',
      "Pick a date between today and 120 days ahead.",
      "Pick where it's on.",
      "Enter between 2 and 40 spots.",
      "The minimum needs to be at least 2, and no more than the spots.",
    ]);
  });

  it("refuses a time that's passed", () => {
    expect(
      parseGroupSessionForm(form({ date: "2026-10-20", time: "08:00" }), places, now, "2026-10-20")
        .problems,
    ).toEqual(["That time has already passed."]);
  });

  it("takes a typed place from a coach who only travels", () => {
    const typed = parseGroupSessionForm(
      form({ place: " Lake Monger Reserve, Wembley " }),
      [],
      now,
      "2026-10-20",
    );
    expect(typed.input?.place).toBe("Lake Monger Reserve, Wembley");
    const empty = parseGroupSessionForm(form({ place: "" }), [], now, "2026-10-20");
    expect(empty.problems).toContain("Pick where it's on.");
  });
});
