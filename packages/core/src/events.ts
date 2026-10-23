import { formatPerthTime } from "./time";

/**
 * Club events (Milestone 21): competitions and social days golfers enter
 * and pay for. Nothing here uses handicaps.
 */

export const EVENT_INTERVALS = [8, 10, 12] as const;
export const TEAM_SIZES = [1, 2, 3, 4] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];
/** Players in a group on the course. */
export const GROUP_SIZE = 4;
export const EVENT_MAX_PLAYERS = 240;
/** How far ahead a club can put on an event. */
export const EVENT_DAYS_AHEAD = 365;
/** Golfers get their reminder this long before the first start. */
export const EVENT_REMINDER_HOURS = 30;

export const TEAM_NAME: Record<TeamSize, string> = {
  1: "Individual",
  2: "Pairs",
  3: "Teams of 3",
  4: "Teams of 4",
};

export interface EventPricing {
  feeCents: number;
  memberFeeCents: number | null;
}

/** The entry fees for a team: the members' fee for each player with a member number. */
export function entryFeesCents(event: EventPricing, players: { memberNumber?: string }[]): number {
  return players.reduce(
    (sum, p) =>
      sum +
      (p.memberNumber && event.memberFeeCents !== null ? event.memberFeeCents : event.feeCents),
    0,
  );
}

export interface EventStart {
  startType: "tees" | "shotgun" | string;
  firstStart: Date;
  intervalMinutes: number;
  twoTees: boolean;
  holes: number;
}

/** The most groups an event's start can take. */
export function maxGroups(event: Pick<EventStart, "startType" | "holes">): number {
  // A shotgun fits two groups a hole; tee times have no limit worth enforcing.
  return event.startType === "shotgun" ? event.holes * 2 : 99;
}

/** When and where a group starts: "7:10 am, 1st tee", or "Hole 4B" for a shotgun. */
export function groupStart(event: EventStart, group: number): { time: Date; where: string } {
  if (event.startType === "shotgun") {
    const doubled = group > event.holes;
    const hole = doubled ? group - event.holes : group;
    return { time: event.firstStart, where: `Hole ${hole}${doubled ? "B" : ""}` };
  }
  const slot = event.twoTees ? Math.floor((group - 1) / 2) : group - 1;
  const tee = event.twoTees && group % 2 === 0 ? "10th tee" : "1st tee";
  return {
    time: new Date(event.firstStart.getTime() + slot * event.intervalMinutes * 60_000),
    where: tee,
  };
}

/** "7:10 am, 1st tee" or "8:00 am shotgun, Hole 4B". */
export function groupStartLabel(event: EventStart, group: number): string {
  const { time, where } = groupStart(event, group);
  return event.startType === "shotgun"
    ? `${formatPerthTime(time)} shotgun, ${where}`
    : `${formatPerthTime(time)}, ${where}`;
}

/**
 * Put entries into groups of up to four, keeping each team together, in the
 * order given (entry order, or shuffled). Each entry goes in the first group
 * with room. Returns each entry's group, from 1.
 */
export function buildStartSheet(entries: { id: string; players: number }[]): Map<string, number> {
  const room: number[] = [];
  const groups = new Map<string, number>();
  for (const e of entries) {
    let g = room.findIndex((left) => left >= e.players);
    if (g === -1) {
      room.push(GROUP_SIZE);
      g = room.length - 1;
    }
    room[g]! -= e.players;
    groups.set(e.id, g + 1);
  }
  return groups;
}

/** A shuffled copy, for a random draw. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Whether a golfer who withdraws now gets their money back: until entries close. */
export function eventFreeToCancel(entriesClose: Date, now: Date): boolean {
  return now < entriesClose;
}
