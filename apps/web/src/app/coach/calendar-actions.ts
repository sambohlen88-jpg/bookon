"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CalendarReadError, fetchBusyTimes, normaliseCalendarUrl } from "@bookon/adapters/calendar";
import { perthToUtc } from "@bookon/core";
import {
  BlockProblem,
  addCoachBlock,
  coachForEmail,
  removeCoachBlock,
  resetCoachCalendarToken,
  saveBusyCalendarError,
  saveBusyCalendarRead,
  setBusyCalendarUrl,
  type Coach,
} from "@bookon/db";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** The coach's calendar (Milestone 16). Every action checks it's the coach's own. */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function signedInCoach(): Promise<Coach> {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach/calendar");
  const coach = await coachForEmail(getDb(), user!.email);
  if (!coach) redirect("/coach");
  return coach!;
}

function back(query: Record<string, string>, anchor: string): never {
  revalidatePath("/coach/calendar");
  redirect(`/coach/calendar?${new URLSearchParams(query)}#${anchor}`);
}

export async function blockOutTime(formData: FormData) {
  const coach = await signedInCoach();
  const day = String(formData.get("day") ?? "");
  if (!DATE.test(day)) back({}, "day");
  const wholeDay = formData.get("wholeDay") === "yes";
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!wholeDay && (!TIME.test(from) || !TIME.test(to)))
    back({ day, problem: "Pick a start and end time, or tick whole day." }, "day");
  const start = perthToUtc(day, wholeDay ? "00:00" : from);
  const end = wholeDay
    ? new Date(perthToUtc(day, "00:00").getTime() + 24 * 60 * 60 * 1000)
    : perthToUtc(day, to);
  try {
    await addCoachBlock(
      getDb(),
      coach.id,
      { start, end, note: String(formData.get("note") ?? "") },
      new Date(),
    );
  } catch (error) {
    if (error instanceof BlockProblem) back({ day, problem: error.message }, "day");
    throw error;
  }
  back({ day, done: "blocked" }, "day");
}

export async function unblockTime(formData: FormData) {
  const coach = await signedInCoach();
  const day = String(formData.get("day") ?? "");
  await removeCoachBlock(getDb(), coach.id, String(formData.get("id") ?? ""));
  back(DATE.test(day) ? { day, done: "unblocked" } : { done: "unblocked" }, "day");
}

/** A new subscription link; the old one stops working. */
export async function newCalendarLink() {
  const coach = await signedInCoach();
  await resetCoachCalendarToken(getDb(), coach.id, new Date());
  back({ done: "newlink" }, "sync");
}

async function readNow(coachId: string, url: string): Promise<string | null> {
  const now = new Date();
  try {
    const busy = await fetchBusyTimes(url, {
      userAgent: `BookOnBot/0.1 (+${process.env.BOOKON_SITE_URL || "https://bookon.com.au"}; ${process.env.BOOKON_CONTACT_EMAIL || "info@bookon.com.au"})`,
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      to: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
      timeoutMs: 15_000,
    });
    await saveBusyCalendarRead(getDb(), coachId, busy, now);
    return null;
  } catch (error) {
    const message =
      error instanceof CalendarReadError
        ? error.message
        : "Your calendar couldn't be read just now. We'll try again soon.";
    await saveBusyCalendarError(getDb(), coachId, message, now);
    return message;
  }
}

/** Save the coach's own calendar link and read it straight away. */
export async function saveBusyCalendar(formData: FormData) {
  const coach = await signedInCoach();
  const checked = normaliseCalendarUrl(String(formData.get("url") ?? ""));
  if ("problem" in checked) back({ problem: checked.problem }, "busy");
  const url = (checked as { url: string }).url;
  await setBusyCalendarUrl(getDb(), coach.id, url, new Date());
  const problem = await readNow(coach.id, url);
  back(problem ? { problem } : { done: "calendar" }, "busy");
}

export async function checkBusyCalendarNow() {
  const coach = await signedInCoach();
  if (!coach.busyCalendarUrl) back({}, "busy");
  const problem = await readNow(coach.id, coach.busyCalendarUrl!);
  back(problem ? { problem } : { done: "checked" }, "busy");
}

export async function removeBusyCalendar() {
  const coach = await signedInCoach();
  await setBusyCalendarUrl(getDb(), coach.id, null, new Date());
  back({ done: "removed" }, "busy");
}
