import { describe, expect, it } from "vitest";
import {
  drawSize,
  matchesInRound,
  nextSlot,
  placeDraw,
  roundCount,
  roundName,
  seedOrder,
} from "./matchplay";

describe("draw size and rounds", () => {
  it("rounds the field up to a power of two", () => {
    expect([2, 3, 5, 8, 9, 20].map(drawSize)).toEqual([2, 4, 8, 8, 16, 32]);
    expect(roundCount(12)).toBe(4);
    expect(matchesInRound(16, 1)).toBe(8);
    expect(matchesInRound(16, 4)).toBe(1);
  });

  it("names rounds from the final back", () => {
    expect([1, 2, 3, 4, 5].map((r) => roundName(r, 5))).toEqual([
      "Round 1",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
  });
});

describe("placeDraw", () => {
  it("keeps the top seeds apart until the final", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("gives the byes to the top seeds", () => {
    const draw = placeDraw(["S1", "S2"], ["a", "b", "c"]);
    // A field of 5 in a draw of 8: seeds 6 to 8 are byes.
    expect(draw).toEqual(["S1", null, "b", "c", "S2", null, "a", null]);
  });

  it("sends each winner to the right place in the next round", () => {
    expect(nextSlot(1, 0)).toEqual({ round: 2, slot: 0, side: "a" });
    expect(nextSlot(1, 3)).toEqual({ round: 2, slot: 1, side: "b" });
  });
});
