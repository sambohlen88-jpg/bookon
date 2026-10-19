"use server";

import { notFound, redirect } from "next/navigation";
import { coachById, lessonById } from "@bookon/db";
import { PRACTICE_PREFIX, lessonPaid, manageLink } from "@bookon/payments";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

async function practiceBooking(formData: FormData) {
  const ctx = await lessonContext();
  if (ctx?.payments.kind !== "practice") notFound();
  const booking = await lessonById(getDb(), String(formData.get("id") ?? ""));
  if (!booking || booking.provider !== "practice") notFound();
  return { ctx: ctx!, booking: booking! };
}

/** Practice only: pretend the card was held, as Stripe would. */
export async function practicePay(formData: FormData) {
  const { ctx, booking } = await practiceBooking(formData);
  if (booking.status === "checkout" && booking.checkoutExpiresAt > ctx.now)
    await lessonPaid(ctx, booking.id, `${PRACTICE_PREFIX}pi_${booking.id}`);
  redirect(`${manageLink(ctx.site, booking)}?paid=1`);
}

/** Practice only: leave the checkout, as Stripe's back link does. */
export async function practiceLeave(formData: FormData) {
  const { booking } = await practiceBooking(formData);
  const coach = await coachById(getDb(), booking.coachId);
  redirect(`/coaches/${coach?.slug}/book?cancelled=${booking.id}`);
}
