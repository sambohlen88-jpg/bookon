"use server";

import { redirect } from "next/navigation";
import { normaliseAuPhone, perthDate } from "@bookon/core";
import { LessonTimeTaken, coachById, liveCoachBySlug, normaliseEmail } from "@bookon/db";
import { BookingProblem, PaymentError, startLessonCheckout } from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { perthClock } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { joinNewsletterIfTicked } from "@/lib/newsletter";

/** Check the golfer's details, hold the time, and send them to pay. */
export async function bookLesson(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const slug = field("slug");
  const rate = field("rate");
  const start = new Date(field("start"));
  const back = (problem: string) => {
    const p = new URLSearchParams({ rate, problem });
    // Back to the same time, so only the details need fixing.
    if (!Number.isNaN(start.getTime())) {
      p.set("date", perthDate(start));
      p.set("time", perthClock(start));
    }
    redirect(`/coaches/${encodeURIComponent(slug)}/book?${p}`);
  };

  const db = getDb();
  const live = await liveCoachBySlug(db, slug);
  const ctx = await lessonContext();
  if (!live || !ctx) back("Booking through BookOn isn't available right now.");
  const coach = (await coachById(db, live!.id))!;

  const golferName = field("name").slice(0, 80);
  const golferEmail = normaliseEmail(field("email"));
  const golferPhone = normaliseAuPhone(field("phone"));
  if (!golferName) back("Add your name.");
  if (!golferEmail) back("Check your email address.");
  if (!golferPhone) back("Add an Australian mobile number, like 0412 345 678.");
  if (formData.get("agree") !== "yes")
    back("Tick the box to agree to the cancellation rule and sharing your details.");
  if (Number.isNaN(start.getTime())) back("Pick a time.");

  let url: string;
  try {
    url = await startLessonCheckout(ctx!, {
      coach,
      rateIndex: Number(rate),
      startTime: start,
      place: field("place"),
      playerPlace: field("playerPlace") || undefined,
      golferName,
      golferEmail: golferEmail!,
      golferPhone: golferPhone!,
      note: field("note").slice(0, 500) || undefined,
      userId: (await currentUser())?.id ?? null,
    });
  } catch (error) {
    if (error instanceof LessonTimeTaken)
      back("Sorry, someone just took that time. Please pick another.");
    if (error instanceof BookingProblem || error instanceof PaymentError) back(error.message);
    throw error;
  }
  await joinNewsletterIfTicked(formData, golferEmail, "lesson");
  redirect(url!);
}
