"use server";

import { notFound, redirect } from "next/navigation";
import {
  coachById,
  entryById,
  groupBookingById,
  groupSessionById,
  lessonById,
  mpEntryById,
} from "@bookon/db";
import {
  PRACTICE_PREFIX,
  entryManageLink,
  entryPaid,
  groupManageLink,
  groupPaid,
  lessonPaid,
  manageLink,
  mpEntryPaid,
  mpManageLink,
} from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

async function practiceContext() {
  const ctx = await lessonContext();
  if (ctx?.payments.kind !== "practice") notFound();
  return ctx!;
}

/** Practice only: pretend the card was held (lessons) or charged (group sessions, events, match play), as Stripe would. */
export async function practicePay(formData: FormData) {
  const ctx = await practiceContext();
  const id = String(formData.get("id") ?? "");
  const lesson = await lessonById(getDb(), id);
  if (lesson?.provider === "practice") {
    if (lesson.status === "checkout" && lesson.checkoutExpiresAt > ctx.now)
      await lessonPaid(ctx, lesson.id, `${PRACTICE_PREFIX}pi_${lesson.id}`);
    redirect(`${manageLink(ctx.site, lesson)}?paid=1`);
  }
  const entry = await entryById(getDb(), id);
  if (entry?.provider === "practice") {
    if (entry.status === "checkout" && entry.checkoutExpiresAt > ctx.now)
      await entryPaid(ctx, entry.id, `${PRACTICE_PREFIX}pi_${entry.id}`);
    redirect(`${entryManageLink(ctx.site, entry)}?paid=1`);
  }
  const mp = await mpEntryById(getDb(), id);
  if (mp?.provider === "practice") {
    if (mp.status === "checkout" && mp.checkoutExpiresAt && mp.checkoutExpiresAt > ctx.now)
      await mpEntryPaid(ctx, mp.id, `${PRACTICE_PREFIX}pi_${mp.id}`);
    redirect(`${mpManageLink(ctx.site, mp)}?paid=1`);
  }
  const group = await groupBookingById(getDb(), id);
  if (group?.provider !== "practice") notFound();
  if (group!.status === "checkout" && group!.checkoutExpiresAt > ctx.now)
    await groupPaid(ctx, group!.id, `${PRACTICE_PREFIX}pi_${group!.id}`);
  redirect(`${groupManageLink(ctx.site, group!)}?paid=1`);
}

/** Practice only: leave the checkout, as Stripe's back link does. */
export async function practiceLeave(formData: FormData) {
  await practiceContext();
  const db = getDb();
  const id = String(formData.get("id") ?? "");
  const lesson = await lessonById(db, id);
  if (lesson?.provider === "practice") {
    const coach = await coachById(db, lesson.coachId);
    redirect(`/coaches/${coach?.slug}/book?cancelled=${lesson.id}`);
  }
  const entry = await entryById(db, id);
  if (entry?.provider === "practice")
    redirect(`/competitions/${entry.eventId}?cancelled=${entry.id}`);
  const mp = await mpEntryById(db, id);
  if (mp?.provider === "practice") redirect(`/matchplay/${mp.compId}?cancelled=${mp.id}`);
  const group = await groupBookingById(db, id);
  const session = group ? await groupSessionById(db, group.sessionId) : null;
  if (group?.provider !== "practice" || !session) notFound();
  const coach = await coachById(db, session!.coachId);
  redirect(`/coaches/${coach?.slug}/sessions/${session!.id}?cancelled=${group!.id}`);
}
