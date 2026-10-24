import type { MatchplayEntry } from "@bookon/db";
import type { BracketSide } from "@/components/matchplay/bracket";

/** "Alex Golfer" or "Alex Golfer & Sam Golfer". */
export function sideLabel(entry: Pick<MatchplayEntry, "players">): string {
  return entry.players.map((p) => p.name).join(" & ");
}

/** Names for the draw sheet, by entry. Contact details never go on the draw. */
export function bracketSides(entries: MatchplayEntry[]): Map<string, BracketSide> {
  return new Map(entries.map((e) => [e.id, { label: sideLabel(e), seed: e.seed }]));
}

export const COMP_STATUS: Record<string, string> = {
  entries: "Taking entries",
  drawn: "Draw made, not out yet",
  playing: "Being played",
  finished: "Finished",
  cancelled: "Cancelled",
};
