"use server";

import { redirect } from "next/navigation";
import { MatchplayProblem, matchById, mpEntryByToken } from "@bookon/db";
import {
  BookingProblem,
  PaymentError,
  confirmAndTell,
  disputeAndTell,
  reportAndTell,
  withdrawMpByGolfer,
} from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/**
 * A player's own match play page (Milestone 22). The link in their emails is
 * their proof the entry is theirs, and each step checks the match is theirs too.
 */

async function fromLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const entry = await mpEntryByToken(getDb(), token);
  if (!entry) redirect("/");
  const page = `/matchplay/entry/${encodeURIComponent(token)}`;
  const back = (query: Record<string, string>): never =>
    redirect(`${page}?${new URLSearchParams(query)}`);
  const ctx = await lessonContext();
  if (!ctx) back({ problem: "This isn't available right now. Please contact the club." });
  return { entry: entry!, ctx: ctx!, back };
}

async function theirMatch(
  formData: FormData,
  entryId: string,
  back: (q: Record<string, string>) => never,
) {
  const match = await matchById(getDb(), String(formData.get("matchId") ?? ""));
  if (!match || (match.entryA !== entryId && match.entryB !== entryId))
    back({ problem: "That match wasn't found." });
  return match!;
}

async function attempt(back: (q: Record<string, string>) => never, step: () => Promise<unknown>) {
  try {
    await step();
  } catch (error) {
    if (
      error instanceof MatchplayProblem ||
      error instanceof BookingProblem ||
      error instanceof PaymentError
    )
      back({ problem: error.message });
    throw error;
  }
}

export async function reportMpResult(formData: FormData) {
  const { entry, ctx, back } = await fromLink(formData);
  const match = await theirMatch(formData, entry.id, back);
  const won = formData.get("won");
  if (won !== "us" && won !== "them") back({ problem: "Pick who won." });
  const other = match.entryA === entry.id ? match.entryB! : match.entryA!;
  const score = String(formData.get("score") ?? "")
    .trim()
    .slice(0, 30);
  await attempt(back, () =>
    reportAndTell(ctx, match, entry, won === "us" ? entry.id : other, score),
  );
  back({ done: "reported" });
}

export async function confirmMpResult(formData: FormData) {
  const { entry, ctx, back } = await fromLink(formData);
  const match = await theirMatch(formData, entry.id, back);
  await attempt(back, () => confirmAndTell(ctx, match, entry));
  back({ done: "confirmed" });
}

export async function disputeMpResult(formData: FormData) {
  const { entry, ctx, back } = await fromLink(formData);
  const match = await theirMatch(formData, entry.id, back);
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || null;
  await attempt(back, () => disputeAndTell(ctx, match, entry, note));
  back({ done: "disputed" });
}

export async function withdrawMpFromLink(formData: FormData) {
  const { entry, ctx, back } = await fromLink(formData);
  await attempt(back, () => withdrawMpByGolfer(ctx, entry));
  back({ done: "withdrawn" });
}
