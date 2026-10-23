"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { perthDate } from "@bookon/core";
import {
  EventEditProblem,
  StartSheetProblem,
  buildStartSheetFor,
  coursesForClub,
  createEvent,
  entryById,
  eventById,
  setEventResults,
  updateEvent,
} from "@bookon/db";
import {
  PaymentError,
  cancelEventByClub,
  clubTakesEntries,
  moveEntryAndTell,
  publishStartSheetAndTell,
  withdrawEntryByClub,
} from "@bookon/payments";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { parseEventForm } from "@/lib/event-form";
import { lessonContext } from "@/lib/lessons";

/**
 * Club events in the club portal (Milestone 21). Every action checks the
 * signed-in person is on the club's team, and that the event is the club's.
 */

function go(path: string, query: Record<string, string> = {}, anchor = ""): never {
  const q = new URLSearchParams(query).toString();
  redirect(`${path}${q ? `?${q}` : ""}${anchor ? `#${anchor}` : ""}`);
}

async function teamEvent(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  const access = await requireClub(clubId, `/club/${clubId}/events`);
  const event = await eventById(getDb(), String(formData.get("eventId") ?? ""));
  if (!event || event.clubId !== access.club.id) go(`/club/${clubId}/events`);
  const page = `/club/${clubId}/events/${event!.id}`;
  return { ...access, event: event!, page };
}

async function context(page: string) {
  const ctx = await lessonContext();
  if (!ctx) go(page, { problem: "Payments through BookOn aren't available right now." });
  return ctx!;
}

function note(formData: FormData): string | null {
  return (
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || null
  );
}

/* Putting on and changing events */

export async function createClubEvent(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  const page = `/club/${clubId}/events/new`;
  const { club, actor } = await requireClub(clubId, page);
  const ctx = await context(page);
  if (!(await clubTakesEntries(ctx, club)))
    go(page, { problem: "Set up payments first (the Payments tab), so golfers can pay to enter." });
  const courseIds = (await coursesForClub(getDb(), club.id)).map((c) => c.id);
  const { input, problems } = parseEventForm(formData, courseIds, ctx.now, perthDate(ctx.now));
  if (!input) go(page, { problem: problems.join(" ") });
  const event = await createEvent(getDb(), club.id, input!, actor, ctx.now);
  revalidatePath(`/club/${club.id}/events`);
  go(`/club/${club.id}/events/${event.id}`, { done: "created" });
}

export async function updateClubEvent(formData: FormData) {
  const { club, actor, event, page } = await teamEvent(formData);
  const now = new Date();
  const courseIds = (await coursesForClub(getDb(), club.id)).map((c) => c.id);
  const { input, problems } = parseEventForm(formData, courseIds, now, perthDate(now));
  if (!input) go(`${page}/edit`, { problem: problems.join(" ") });
  try {
    await updateEvent(getDb(), event, input!, actor, now);
  } catch (error) {
    if (error instanceof EventEditProblem) go(`${page}/edit`, { problem: error.message });
    throw error;
  }
  revalidatePath(page);
  go(page, { done: "saved" });
}

export async function cancelClubEvent(formData: FormData) {
  const { event, actor, page } = await teamEvent(formData);
  const ctx = await context(page);
  try {
    const result = await cancelEventByClub(ctx, event, note(formData), actor);
    if (!result) go(page, { problem: "This event was already cancelled." });
  } catch (error) {
    if (error instanceof PaymentError) go(page, { problem: error.message });
    throw error;
  }
  revalidatePath(page);
  go(page, { done: "cancelled" });
}

/* Entries */

async function clubWithdraw(formData: FormData, refund: boolean) {
  const { event, page } = await teamEvent(formData);
  const entry = await entryById(getDb(), String(formData.get("entryId") ?? ""));
  if (!entry || entry.eventId !== event.id) go(page, { problem: "That entry wasn't found." });
  const ctx = await context(page);
  try {
    const ended = await withdrawEntryByClub(ctx, entry!, { refund, note: note(formData) });
    if (!ended) go(page, { problem: "That entry had already been withdrawn." }, "entries");
  } catch (error) {
    if (error instanceof PaymentError) go(page, { problem: error.message }, "entries");
    throw error;
  }
  revalidatePath(page);
  go(page, { done: refund ? "refunded" : "withdrawn" }, "entries");
}

export async function withdrawEntryWithRefund(formData: FormData) {
  await clubWithdraw(formData, true);
}

export async function withdrawEntryNoRefund(formData: FormData) {
  await clubWithdraw(formData, false);
}

/* Start sheet */

async function makeStartSheet(formData: FormData, shuffle: boolean) {
  const { event, page } = await teamEvent(formData);
  try {
    await buildStartSheetFor(getDb(), event, shuffle);
  } catch (error) {
    if (error instanceof StartSheetProblem) go(page, { problem: error.message }, "start-sheet");
    throw error;
  }
  revalidatePath(page);
  go(page, { done: "sheet" }, "start-sheet");
}

export async function makeStartSheetInOrder(formData: FormData) {
  await makeStartSheet(formData, false);
}

export async function makeStartSheetShuffled(formData: FormData) {
  await makeStartSheet(formData, true);
}

export async function moveEntry(formData: FormData) {
  const { event, page } = await teamEvent(formData);
  const ctx = await context(page);
  try {
    await moveEntryAndTell(
      ctx,
      event,
      String(formData.get("entryId") ?? ""),
      Number(formData.get("group")),
    );
  } catch (error) {
    if (error instanceof StartSheetProblem) go(page, { problem: error.message }, "start-sheet");
    throw error;
  }
  revalidatePath(page);
  go(page, { done: "moved" }, "start-sheet");
}

export async function publishClubStartSheet(formData: FormData) {
  const { event, actor, page } = await teamEvent(formData);
  const ctx = await context(page);
  try {
    await publishStartSheetAndTell(ctx, event, actor);
  } catch (error) {
    if (error instanceof StartSheetProblem) go(page, { problem: error.message }, "start-sheet");
    throw error;
  }
  revalidatePath(page);
  go(page, { done: "published" }, "start-sheet");
}

export async function saveEventResults(formData: FormData) {
  const { event, page } = await teamEvent(formData);
  const results =
    String(formData.get("results") ?? "")
      .trim()
      .slice(0, 4000) || null;
  await setEventResults(getDb(), event, results, new Date());
  revalidatePath(page);
  go(page, { done: "results" }, "results");
}
