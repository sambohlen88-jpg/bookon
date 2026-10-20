"use server";

import { notFound, redirect } from "next/navigation";
import { coachById, groupBookingById, groupSessionById, lessonById } from "@bookon/db";
import {
  PRACTICE_PREFIX,
  groupManageLink,
  groupPaid,
  lessonPaid,
  manageLink,
} from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

async function practiceContext() {
  const ctx = await lessonContext();
  if (ctx?.payments.kind !== "practice") notFound();
  return ctx!;
}

/** Practice only: pretend the card was held (lessons) or charged (group sessions), as Stripe would. */
export async function practicePay(formData: FormData) {
  const ctx = await practiceContext();
  const id = String(formData.get("id") ?? "");
  const lesson = await lessonById(getDb(), id);
  if (lesson?.provider === "practice") {
    if (lesson.status === "checkout" && lesson.checkoutExpiresAt > ctx.now)
      await lessonPaid(ctx, lesson.id, `${PRACTICE_PREFIX}pi_${lesson.id}`);
    redirect(`${manageLink(ctx.site, lesson)}?paid=1`);
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
  const group = await groupBookingById(db, id);
  const session = group ? await groupSessionById(db, group.sessionId) : null;
  if (group?.provider !== "practice" || !session) notFound();
  const coach = await coachById(db, session!.coachId);
  redirect(`/coaches/${coach?.slug}/sessions/${session!.id}?cancelled=${group!.id}`);
}
