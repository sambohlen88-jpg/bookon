"use server";

import { redirect } from "next/navigation";
import { normaliseAuPhone } from "@bookon/core";
import { coachById, groupSessionById, liveCoachBySlug, normaliseEmail } from "@bookon/db";
import { BookingProblem, PaymentError, startGroupCheckout } from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { joinNewsletterIfTicked } from "@/lib/newsletter";

/** Check the golfer's details, hold their spots, and send them to pay (Milestone 19). */
export async function bookGroupSpots(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const slug = field("slug");
  const id = field("session");
  const spots = Number(field("spots"));
  const back = (problem: string) => {
    const p = new URLSearchParams({ spots: String(spots || 1), problem });
    redirect(`/coaches/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(id)}?${p}`);
  };

  const db = getDb();
  const live = await liveCoachBySlug(db, slug);
  const ctx = await lessonContext();
  if (!live || !ctx) back("Booking through BookOn isn't available right now.");
  const coach = (await coachById(db, live!.id))!;
  const session = await groupSessionById(db, id);
  if (!session || session.coachId !== coach.id) back("That session wasn't found.");

  const golferName = field("name").slice(0, 80);
  const golferEmail = normaliseEmail(field("email"));
  const golferPhone = normaliseAuPhone(field("phone"));
  if (!golferName) back("Add your name.");
  if (!golferEmail) back("Check your email address.");
  if (!golferPhone) back("Add an Australian mobile number, like 0412 345 678.");
  if (formData.get("agree") !== "yes")
    back("Tick the box to agree to the cancellation rule and sharing your details.");

  let url: string;
  try {
    url = await startGroupCheckout(ctx!, {
      coach,
      session: session!,
      spots,
      golferName,
      golferEmail: golferEmail!,
      golferPhone: golferPhone!,
      note: field("note").slice(0, 500) || undefined,
      userId: (await currentUser())?.id ?? null,
    });
  } catch (error) {
    if (error instanceof BookingProblem || error instanceof PaymentError) back(error.message);
    throw error;
  }
  await joinNewsletterIfTicked(formData, golferEmail, "group-session");
  redirect(url!);
}
