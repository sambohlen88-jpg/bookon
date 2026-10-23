import { describe, expect, it } from "vitest";
import {
  buildStartSheet,
  entryFeesCents,
  groupStart,
  groupStartLabel,
  maxGroups,
  shuffled,
} from "./events";
import { perthToUtc } from "./time";

const first = perthToUtc("2026-11-14", "07:00");
const tees = {
  startType: "tees",
  firstStart: first,
  intervalMinutes: 10,
  twoTees: false,
  holes: 18,
};

describe("entryFeesCents", () => {
  it("charges members' fee only to players with a member number", () => {
    const event = { feeCents: 4500, memberFeeCents: 3000 };
    expect(entryFeesCents(event, [{ memberNumber: "1234" }, {}])).toBe(7500);
    expect(entryFeesCents({ ...event, memberFeeCents: null }, [{ memberNumber: "1" }])).toBe(4500);
  });
});

describe("start times", () => {
  it("spaces tee times by the interval", () => {
    expect(groupStartLabel(tees, 1)).toBe("7:00 am, 1st tee");
    expect(groupStartLabel(tees, 3)).toBe("7:20 am, 1st tee");
  });

  it("sends groups off the 1st and 10th together", () => {
    const two = { ...tees, twoTees: true };
    expect(groupStartLabel(two, 1)).toBe("7:00 am, 1st tee");
    expect(groupStartLabel(two, 2)).toBe("7:00 am, 10th tee");
    expect(groupStartLabel(two, 3)).toBe("7:10 am, 1st tee");
  });

  it("gives each shotgun group a hole, doubling up as B groups", () => {
    const shotgun = { ...tees, startType: "shotgun", holes: 9 };
    expect(groupStart(shotgun, 4)).toEqual({ time: first, where: "Hole 4" });
    expect(groupStartLabel(shotgun, 13)).toBe("7:00 am shotgun, Hole 4B");
    expect(maxGroups(shotgun)).toBe(18);
  });
});

describe("buildStartSheet", () => {
  it("keeps teams together in groups of up to four, in order", () => {
    const groups = buildStartSheet([
      { id: "a", players: 2 },
      { id: "b", players: 3 },
      { id: "c", players: 2 },
      { id: "d", players: 1 },
      { id: "e", players: 4 },
    ]);
    expect(Object.fromEntries(groups)).toEqual({ a: 1, b: 2, c: 1, d: 2, e: 3 });
  });

  it("puts individuals four to a group", () => {
    const groups = buildStartSheet(
      Array.from({ length: 6 }, (_, i) => ({ id: String(i), players: 1 })),
    );
    expect([...groups.values()]).toEqual([1, 1, 1, 1, 2, 2]);
  });
});

describe("shuffled", () => {
  it("keeps every item", () => {
    const items = ["a", "b", "c", "d"];
    expect(shuffled(items).sort()).toEqual(items);
  });
});
