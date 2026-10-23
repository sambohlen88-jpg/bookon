/** Reading a club event from the club portal (Milestone 21). */
import {
  EVENT_DAYS_AHEAD,
  EVENT_INTERVALS,
  EVENT_MAX_PLAYERS,
  TEAM_SIZES,
  addPerthDays,
  maxGroups,
  perthToUtc,
} from "@bookon/core";
import type { EventInput } from "@bookon/db";
import { str } from "./club-form";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dollars(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ""));
  return text.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** The event as typed, or what to fix. `courseIds` are the club's own courses. */
export function parseEventForm(
  form: FormData,
  courseIds: string[],
  now: Date,
  today: string,
): { input: EventInput | null; problems: string[] } {
  const problems: string[] = [];
  const title = str(form, "title", 100) ?? "";
  if (!title) problems.push('Give the event a name, like "Saturday Ambrose".');
  const description = str(form, "description", 2000) ?? null;

  const courseId = String(form.get("courseId") ?? "");
  if (!courseIds.includes(courseId)) problems.push("Pick which course it's on.");

  const date = String(form.get("date") ?? "");
  if (
    !DATE.test(date) ||
    addPerthDays(date, 0) !== date ||
    date < today ||
    date > addPerthDays(today, EVENT_DAYS_AHEAD)
  )
    problems.push("Pick a date from today up to a year ahead.");
  const holes = Number(form.get("holes"));
  if (holes !== 9 && holes !== 18) problems.push("Pick 9 or 18 holes.");

  const startType = form.get("startType") === "shotgun" ? "shotgun" : "tees";
  const time = String(form.get("time") ?? "");
  if (!TIME.test(time)) problems.push("Pick the first start time.");
  const intervalMinutes = Number(form.get("interval") ?? 10);
  if (startType === "tees" && !(EVENT_INTERVALS as readonly number[]).includes(intervalMinutes))
    problems.push("Pick the time between groups.");
  const twoTees = startType === "tees" && form.get("twoTees") === "yes";

  const teamSize = Number(form.get("teamSize"));
  if (!(TEAM_SIZES as readonly number[]).includes(teamSize)) problems.push("Pick the format.");

  const feeCents = dollars(String(form.get("fee") ?? ""));
  if (feeCents === null || feeCents < 100 || feeCents > 100_000)
    problems.push("Enter an entry fee per player between $1 and $1000.");
  const memberText = String(form.get("memberFee") ?? "");
  const memberFeeCents = memberText.trim() ? dollars(memberText) : null;
  if (memberText.trim() && (memberFeeCents === null || memberFeeCents < 100))
    problems.push("Enter the members' fee as an amount of at least $1, or leave it empty.");
  else if (memberFeeCents !== null && feeCents !== null && memberFeeCents > feeCents)
    problems.push("The members' fee should be no more than the usual fee.");

  const maxPlayers = Number(form.get("maxPlayers"));
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > EVENT_MAX_PLAYERS)
    problems.push(`Enter a field of 2 to ${EVENT_MAX_PLAYERS} players.`);
  else if (teamSize > 1 && maxPlayers % teamSize !== 0)
    problems.push(`With teams of ${teamSize}, make the field a multiple of ${teamSize}.`);
  else if (
    startType === "shotgun" &&
    (holes === 9 || holes === 18) &&
    maxPlayers > maxGroups({ startType, holes }) * 4
  )
    problems.push(
      `A shotgun on ${holes} holes takes up to ${maxGroups({ startType, holes }) * 4} players.`,
    );

  const closeDate = String(form.get("closeDate") ?? "");
  const closeTime = String(form.get("closeTime") ?? "");
  if (!DATE.test(closeDate) || addPerthDays(closeDate, 0) !== closeDate || !TIME.test(closeTime))
    problems.push("Pick when entries close.");

  const open = form.get("open") !== "members";
  if (problems.length > 0) return { input: null, problems };

  const firstStart = perthToUtc(date, time);
  const entriesClose = perthToUtc(closeDate, closeTime);
  if (entriesClose > firstStart) problems.push("Entries need to close before the event starts.");
  if (firstStart <= now) problems.push("That start time has already passed.");
  if (problems.length > 0) return { input: null, problems };

  return {
    input: {
      courseId,
      title,
      description,
      date,
      holes,
      startType,
      firstStart,
      intervalMinutes: startType === "tees" ? intervalMinutes : 10,
      twoTees,
      teamSize,
      feeCents: feeCents!,
      memberFeeCents,
      maxPlayers,
      entriesClose,
      open,
    },
    problems: [],
  };
}
