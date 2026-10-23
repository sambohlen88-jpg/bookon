import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { parseEventForm } from "./event-form";

const now = perthToUtc("2026-10-23", "09:00");

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    title: "Saturday Ambrose",
    courseId: "c1",
    date: "2026-11-14",
    holes: "18",
    startType: "tees",
    time: "07:00",
    interval: "10",
    teamSize: "4",
    fee: "45",
    memberFee: "30",
    maxPlayers: "64",
    closeDate: "2026-11-12",
    closeTime: "17:00",
    open: "open",
    ...values,
  }))
    f.set(k, v);
  return f;
}

const parse = (values: Record<string, string> = {}) =>
  parseEventForm(form(values), ["c1"], now, "2026-10-23");

describe("parseEventForm", () => {
  it("reads an event", () => {
    const { input, problems } = parse({ twoTees: "yes", fee: "$45.50" });
    expect(problems).toEqual([]);
    expect(input).toMatchObject({
      title: "Saturday Ambrose",
      firstStart: perthToUtc("2026-11-14", "07:00"),
      entriesClose: perthToUtc("2026-11-12", "17:00"),
      teamSize: 4,
      feeCents: 4550,
      memberFeeCents: 3000,
      twoTees: true,
      open: true,
    });
  });

  it("checks the field suits the format and start", () => {
    expect(parse({ maxPlayers: "30" }).problems).toEqual([
      "With teams of 4, make the field a multiple of 4.",
    ]);
    expect(parse({ startType: "shotgun", holes: "9", maxPlayers: "80" }).problems).toEqual([
      "A shotgun on 9 holes takes up to 72 players.",
    ]);
  });

  it("needs entries to close before the start, and a members' fee no higher than the fee", () => {
    expect(parse({ closeDate: "2026-11-15" }).problems).toEqual([
      "Entries need to close before the event starts.",
    ]);
    expect(parse({ memberFee: "50" }).problems).toEqual([
      "The members' fee should be no more than the usual fee.",
    ]);
  });

  it("refuses a course from another club", () => {
    expect(parseEventForm(form({ courseId: "c2" }), ["c1"], now, "2026-10-23").problems).toEqual([
      "Pick which course it's on.",
    ]);
  });
});
