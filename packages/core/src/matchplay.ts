/**
 * Match play (Milestone 22): knockout competitions a club runs over several
 * weeks. Results are written as the players report them ("3&2", "1 up");
 * nothing here works out handicaps or strokes.
 */

/** Hours the other side has to dispute a reported result before it stands. */
export const DISPUTE_HOURS = 48;
/** Days before a play-by date that unplayed matches get a reminder. */
export const MATCH_REMINDER_DAYS = 3;
export const MATCHPLAY_MAX_ENTRIES = 128;

/** The draw's size: the next power of two that fits the field (at least 2). */
export function drawSize(entries: number): number {
  let size = 2;
  while (size < entries) size *= 2;
  return size;
}

export function roundCount(entries: number): number {
  return Math.log2(drawSize(entries));
}

/**
 * Seed numbers down the draw, so seed 1 and 2 can only meet in the final:
 * for 8, [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Place the field in the draw. `seeded` are in seed order; `others` fill the
 * remaining seed numbers in the order given (shuffle them for a random draw).
 * Numbers beyond the field are byes, so the top seeds get them. Returns each
 * draw position's entry, or null for a bye.
 */
export function placeDraw<T>(seeded: T[], others: T[]): (T | null)[] {
  const field = [...seeded, ...others];
  const size = drawSize(field.length);
  return seedOrder(size).map((n) => field[n - 1] ?? null);
}

/** "Final", "Semi-finals", "Quarter-finals", "Round of 16", or "Round 1". */
export function roundName(round: number, rounds: number): string {
  const left = rounds - round;
  if (left === 0) return "Final";
  if (left === 1) return "Semi-finals";
  if (left === 2) return "Quarter-finals";
  if (left === 3) return "Round of 16";
  return `Round ${round}`;
}

/** Where a match's winner goes: the next round's match and side. */
export function nextSlot(
  round: number,
  slot: number,
): { round: number; slot: number; side: "a" | "b" } {
  return { round: round + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "a" : "b" };
}

/** Matches in a round of a draw. */
export function matchesInRound(size: number, round: number): number {
  return size / 2 ** round;
}
