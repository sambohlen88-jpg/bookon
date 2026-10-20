/** Reading a new group session from My coaching (Milestone 19). */
import {
  GROUP_DAYS_AHEAD,
  GROUP_MAX_SPOTS,
  GROUP_MAX_WEEKS,
  addPerthDays,
  perthToUtc,
  weeklyDates,
} from "@bookon/core";
import type { NewGroupSessions } from "@bookon/db";
import { str } from "./club-form";

export const SESSION_LENGTHS = [30, 45, 60, 90, 120, 150, 180, 240] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The sessions to put on, or what to fix. `places` are the coach's teaching places, as labels. */
export function parseGroupSessionForm(
  form: FormData,
  places: string[],
  now: Date,
  today: string,
): { input: Omit<NewGroupSessions, "coachId"> | null; problems: string[] } {
  const problems: string[] = [];
  const title = str(form, "title", 80) ?? "";
  if (!title) problems.push('Give the session a name, like "Beginners\' clinic".');
  const details = str(form, "details", 500);

  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "");
  const lastDay = addPerthDays(today, GROUP_DAYS_AHEAD);
  if (!DATE.test(date) || addPerthDays(date, 0) !== date || date < today || date > lastDay)
    problems.push(`Pick a date between today and ${GROUP_DAYS_AHEAD} days ahead.`);
  if (!TIME.test(time)) problems.push("Pick a start time.");

  const minutes = Number(form.get("minutes"));
  if (!(SESSION_LENGTHS as readonly number[]).includes(minutes)) problems.push("Pick how long.");

  const place = String(form.get("place") ?? "");
  if (!places.includes(place)) problems.push("Pick where it's on.");

  const price = Number(String(form.get("price") ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 1 || price > 1000)
    problems.push("Enter a price per person between $1 and $1000.");

  const spots = Number(form.get("spots"));
  if (!Number.isInteger(spots) || spots < 2 || spots > GROUP_MAX_SPOTS)
    problems.push(`Enter between 2 and ${GROUP_MAX_SPOTS} spots.`);

  const minText = String(form.get("minSpots") ?? "").trim();
  const minSpots = minText ? Number(minText) : null;
  if (minSpots !== null && (!Number.isInteger(minSpots) || minSpots < 2 || minSpots > spots))
    problems.push("The minimum needs to be at least 2, and no more than the spots.");

  const weeks = Number(form.get("weeks") ?? 1);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > GROUP_MAX_WEEKS)
    problems.push(`Repeat for up to ${GROUP_MAX_WEEKS} weeks.`);

  if (problems.length > 0) return { input: null, problems };
  const starts = weeklyDates(date, weeks).map((d) => perthToUtc(d, time));
  if (starts[0]! <= now) return { input: null, problems: ["That time has already passed."] };
  return {
    input: {
      title,
      details: details ?? null,
      starts,
      minutes,
      place,
      priceCents: Math.round(price * 100),
      spots,
      minSpots,
    },
    problems: [],
  };
}
