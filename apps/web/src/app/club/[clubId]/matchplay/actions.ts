"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { shuffled } from "@bookon/core";
import {
  MatchplayProblem,
  addClubEntry,
  compById,
  coursesForClub,
  createComp,
  makeDraw,
  matchById,
  mpEntryById,
  reopenEntries,
  setRoundDates,
  setSeeds,
  swapInDraw,
  updateComp,
} from "@bookon/db";
import {
  BookingProblem,
  PaymentError,
  cancelCompByClub,
  clubResultAndTell,
  clubTakesEntries,
  publishDrawAndTell,
  withdrawMpByClub,
} from "@bookon/payments";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { parseClubEntry, parseCompForm } from "@/lib/matchplay-form";

/**
 * Match play in the club portal (Milestone 22). Every action checks the
 * signed-in person is on the club's team, and that the competition is the club's.
 */

function go(path: string, query: Record<string, string> = {}, anchor = ""): never {
  const q = new URLSearchParams(query).toString();
  redirect(`${path}${q ? `?${q}` : ""}${anchor ? `#${anchor}` : ""}`);
}

async function teamComp(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  const access = await requireClub(clubId, `/club/${clubId}/matchplay`);
  const comp = await compById(getDb(), String(formData.get("compId") ?? ""));
  if (!comp || comp.clubId !== access.club.id) go(`/club/${clubId}/matchplay`);
  return { ...access, comp: comp!, page: `/club/${clubId}/matchplay/${comp!.id}` };
}

async function context(page: string) {
  const ctx = await lessonContext();
  if (!ctx) go(page, { problem: "This isn't available right now." });
  return ctx!;
}

/** Run a step, sending any problem back to the page. */
async function attempt(page: string, anchor: string, step: () => Promise<unknown>) {
  try {
    await step();
  } catch (error) {
    if (
      error instanceof MatchplayProblem ||
      error instanceof BookingProblem ||
      error instanceof PaymentError
    )
      go(page, { problem: error.message }, anchor);
    throw error;
  }
}

function note(formData: FormData): string | null {
  return (
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || null
  );
}

/* Setting up */

export async function createMatchplay(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  const page = `/club/${clubId}/matchplay/new`;
  const { club, actor } = await requireClub(clubId, page);
  const ctx = await context(page);
  const courseIds = (await coursesForClub(getDb(), club.id)).map((c) => c.id);
  const { input, problems } = parseCompForm(formData, courseIds, ctx.now);
  if (!input) go(page, { problem: problems.join(" ") });
  if (input!.feeCents > 0 && !(await clubTakesEntries(ctx, club)))
    go(page, { problem: "Set up payments first (the Payments tab) to charge an entry fee." });
  const comp = await createComp(getDb(), club.id, input!, actor, ctx.now);
  revalidatePath(`/club/${club.id}/matchplay`);
  go(`/club/${club.id}/matchplay/${comp.id}`, { done: "created" });
}

export async function updateMatchplay(formData: FormData) {
  const { club, comp, page } = await teamComp(formData);
  const ctx = await context(page);
  const courseIds = (await coursesForClub(getDb(), club.id)).map((c) => c.id);
  const { input, problems } = parseCompForm(formData, courseIds, ctx.now);
  if (!input) go(`${page}/edit`, { problem: problems.join(" ") });
  if (input!.feeCents > 0 && !(await clubTakesEntries(ctx, club)))
    go(`${page}/edit`, {
      problem: "Set up payments first (the Payments tab) to charge an entry fee.",
    });
  await attempt(`${page}/edit`, "", () => updateComp(getDb(), comp, input!, ctx.now));
  revalidatePath(page);
  go(page, { done: "saved" });
}

export async function cancelMatchplay(formData: FormData) {
  const { comp, actor, page } = await teamComp(formData);
  const ctx = await context(page);
  await attempt(page, "", async () => {
    if (!(await cancelCompByClub(ctx, comp, note(formData), actor)))
      throw new MatchplayProblem("This competition was already cancelled or finished.");
  });
  revalidatePath(page);
  go(page, { done: "cancelled" });
}

/* Entries */

export async function addMatchplayEntry(formData: FormData) {
  const { comp, actor, page } = await teamComp(formData);
  const parsed = parseClubEntry(formData, comp.teamSize);
  if ("problem" in parsed) go(page, { problem: parsed.problem }, "entries");
  await attempt(page, "entries", () =>
    addClubEntry(
      getDb(),
      comp,
      (parsed as Extract<typeof parsed, { entry: unknown }>).entry,
      actor,
      new Date(),
    ),
  );
  revalidatePath(page);
  go(page, { done: "added" }, "entries");
}

async function clubWithdraw(formData: FormData, refund: boolean) {
  const { comp, page } = await teamComp(formData);
  const entry = await mpEntryById(getDb(), String(formData.get("entryId") ?? ""));
  if (!entry || entry.compId !== comp.id)
    go(page, { problem: "That entry wasn't found." }, "entries");
  const ctx = await context(page);
  await attempt(page, "entries", () =>
    withdrawMpByClub(ctx, entry!, { refund, note: note(formData) }),
  );
  revalidatePath(page);
  go(page, { done: "withdrawn" }, "entries");
}

export async function withdrawMpEntryWithRefund(formData: FormData) {
  await clubWithdraw(formData, true);
}

export async function withdrawMpEntryNoRefund(formData: FormData) {
  await clubWithdraw(formData, false);
}

export async function saveSeeds(formData: FormData) {
  const { comp, page } = await teamComp(formData);
  const seeds = new Map<string, number | null>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("seed-")) continue;
    const n = Number(value);
    seeds.set(key.slice(5), String(value).trim() && Number.isInteger(n) && n > 0 ? n : null);
  }
  const taken = [...seeds.values()].filter((n): n is number => n !== null);
  if (new Set(taken).size !== taken.length)
    go(page, { problem: "Two entries have the same seed." }, "entries");
  await attempt(page, "entries", () => setSeeds(getDb(), comp, seeds));
  revalidatePath(page);
  go(page, { done: "seeds" }, "entries");
}

/* The draw */

export async function makeMatchplayDraw(formData: FormData) {
  const { comp, page } = await teamComp(formData);
  await attempt(page, "draw", () => makeDraw(getDb(), comp, shuffled, new Date()));
  revalidatePath(page);
  go(page, { done: "drawn" }, "draw");
}

export async function reopenMatchplayEntries(formData: FormData) {
  const { comp, page } = await teamComp(formData);
  await attempt(page, "entries", () => reopenEntries(getDb(), comp, new Date()));
  revalidatePath(page);
  go(page, { done: "reopened" }, "entries");
}

export async function swapMatchplayDraw(formData: FormData) {
  const { comp, page } = await teamComp(formData);
  await attempt(page, "draw", () =>
    swapInDraw(
      getDb(),
      comp,
      String(formData.get("first") ?? ""),
      String(formData.get("second") ?? ""),
      new Date(),
    ),
  );
  revalidatePath(page);
  go(page, { done: "swapped" }, "draw");
}

export async function saveRoundDates(formData: FormData) {
  const { comp, page } = await teamComp(formData);
  const dates = formData
    .getAll("playBy")
    .map((v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null));
  await setRoundDates(getDb(), comp, dates, new Date());
  revalidatePath(page);
  go(page, { done: "dates" }, "draw");
}

export async function publishMatchplayDraw(formData: FormData) {
  const { comp, actor, page } = await teamComp(formData);
  const ctx = await context(page);
  await attempt(page, "draw", () => publishDrawAndTell(ctx, comp, actor));
  revalidatePath(page);
  go(page, { done: "published" }, "draw");
}

/* Results */

async function setResult(formData: FormData, walkover: boolean) {
  const { comp, page } = await teamComp(formData);
  const match = await matchById(getDb(), String(formData.get("matchId") ?? ""));
  if (!match || match.compId !== comp.id)
    go(page, { problem: "That match wasn't found." }, "matches");
  const ctx = await context(page);
  const winner = String(formData.get("winner") ?? "");
  const score = walkover
    ? "Walkover"
    : String(formData.get("score") ?? "")
        .trim()
        .slice(0, 30);
  await attempt(page, `match-${match!.id}`, () => clubResultAndTell(ctx, match!, winner, score));
  revalidatePath(page);
  go(page, { done: walkover ? "walkover" : "result" }, `match-${match!.id}`);
}

export async function recordMatchResult(formData: FormData) {
  await setResult(formData, false);
}

export async function awardWalkover(formData: FormData) {
  await setResult(formData, true);
}
