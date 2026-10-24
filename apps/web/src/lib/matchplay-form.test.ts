import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { parseClubEntry, parseCompForm } from "./matchplay-form";

const now = perthToUtc("2026-10-24", "09:00");

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("parseCompForm", () => {
  const base = {
    title: "Club Matchplay",
    courseId: "c1",
    teamSize: "1",
    onlineEntry: "yes",
    fee: "20",
    maxEntries: "32",
    closeDate: "2026-11-01",
    closeTime: "17:00",
    open: "open",
  };

  it("reads a competition", () => {
    const { input, problems } = parseCompForm(form(base), ["c1"], now);
    expect(problems).toEqual([]);
    expect(input).toMatchObject({
      feeCents: 2000,
      maxEntries: 32,
      onlineEntry: true,
      entriesClose: perthToUtc("2026-11-01", "17:00"),
    });
  });

  it("needs a closing date for online entry, but not when the club types the field in", () => {
    expect(parseCompForm(form({ ...base, closeDate: "" }), ["c1"], now).problems).toEqual([
      "Pick when online entries close.",
    ]);
    const typed = parseCompForm(form({ ...base, onlineEntry: "", closeDate: "" }), ["c1"], now);
    expect(typed.input).toMatchObject({ onlineEntry: false, feeCents: 0, entriesClose: null });
  });
});

describe("parseClubEntry", () => {
  it("needs a name and a way to reach them", () => {
    expect(parseClubEntry(form({ player0: "Ann", phone: "0491 570 110" }), 1)).toEqual({
      entry: { players: [{ name: "Ann" }], contactEmail: null, contactPhone: "+61491570110" },
    });
    expect(parseClubEntry(form({ player0: "Ann" }), 1)).toEqual({
      problem: "Add an email or a mobile, so their opponents can reach them.",
    });
    expect(parseClubEntry(form({ player0: "Ann", email: "a@x.com" }), 2)).toEqual({
      problem: "Add both players' names.",
    });
  });
});
