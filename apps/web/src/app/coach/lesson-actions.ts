"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  acceptLessonPaymentTerms,
  acceptedLessonPaymentTerms,
  coachForEmail,
  lessonById,
  setCoachTakesBookings,
  type Coach,
} from "@bookon/db";
import {
  PaymentError,
  acceptLessonRequest,
  cancelLessonByCoach,
  coachPaymentsSetupLink,
  declineLessonRequest,
  refreshCoachPayments,
  usableAccount,
} from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** Lesson bookings and payments in My coaching (Milestone 15). Every action checks it's the coach's own. */

function back(query: Record<string, string>, anchor = "lessons"): never {
  redirect(`/coach?${new URLSearchParams(query)}#${anchor}`);
}

async function signedInCoach(): Promise<Coach> {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach");
  const coach = await coachForEmail(getDb(), user!.email);
  if (!coach || coach.status !== "live") back({ problem: "Your listing needs to be live first." });
  return coach!;
}

async function context() {
  const ctx = await lessonContext();
  if (!ctx) back({ problem: "Payments through BookOn aren't available right now." }, "payments");
  return ctx!;
}

async function ownBooking(coach: Coach, formData: FormData) {
  const booking = await lessonById(getDb(), String(formData.get("id") ?? ""));
  if (!booking || booking.coachId !== coach.id) back({ problem: "That booking wasn't found." });
  return booking!;
}

function note(formData: FormData): string | null {
  return (
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || null
  );
}

/** Agree to the payment terms (the first time), then go to Stripe to set up or finish the account. */
export async function setUpCoachPayments(formData: FormData) {
  const coach = await signedInCoach();
  const ctx = await context();
  if (!acceptedLessonPaymentTerms(coach.consents)) {
    const by = String(formData.get("termsBy") ?? "")
      .trim()
      .slice(0, 80);
    if (formData.get("terms") !== "yes" || !by)
      back(
        { problem: "Tick the box and add your name to agree to the payment terms." },
        "payments",
      );
    await acceptLessonPaymentTerms(ctx.db, coach.id, by, ctx.now);
  }
  let link: string;
  try {
    const returnUrl = `${ctx.site}/coach?payments=back#payments`;
    link = await coachPaymentsSetupLink(ctx, coach, { returnUrl, refreshUrl: returnUrl });
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message }, "payments");
    throw error;
  }
  redirect(link!);
}

export async function openStripeDashboard() {
  const coach = await signedInCoach();
  const ctx = await context();
  if (!usableAccount(ctx.payments, coach.paymentAccountId)) back({}, "payments");
  let link: string;
  try {
    link = await ctx.payments.dashboardLink(coach.paymentAccountId!);
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message }, "payments");
    throw error;
  }
  redirect(link!);
}

export async function turnBookingsOn() {
  const coach = await signedInCoach();
  const ctx = await context();
  // Ask Stripe first, in case the account has only just been finished.
  await refreshCoachPayments(ctx, coach);
  const on = await setCoachTakesBookings(ctx.db, coach.id, true, ctx.now);
  revalidatePath("/coach");
  back(
    on ? { bookings: "on" } : { problem: "Finish setting up payments with Stripe first." },
    "payments",
  );
}

export async function turnBookingsOff() {
  const coach = await signedInCoach();
  await setCoachTakesBookings(getDb(), coach.id, false, new Date());
  revalidatePath("/coach");
  back({ bookings: "off" }, "payments");
}

async function run(action: () => Promise<unknown>, done: string) {
  try {
    const result = await action();
    if (!result) back({ problem: "That booking has already moved on. Here's where it's at now." });
  } catch (error) {
    if (error instanceof PaymentError) back({ problem: error.message });
    throw error;
  }
  revalidatePath("/coach");
  back({ done });
}

export async function acceptLessonFromPortal(formData: FormData) {
  const coach = await signedInCoach();
  const booking = await ownBooking(coach, formData);
  const ctx = await context();
  await run(() => acceptLessonRequest(ctx, booking), "accepted");
}

export async function declineLessonFromPortal(formData: FormData) {
  const coach = await signedInCoach();
  const booking = await ownBooking(coach, formData);
  const ctx = await context();
  await run(() => declineLessonRequest(ctx, booking, note(formData)), "declined");
}

export async function cancelLessonFromPortal(formData: FormData) {
  const coach = await signedInCoach();
  const booking = await ownBooking(coach, formData);
  const ctx = await context();
  await run(() => cancelLessonByCoach(ctx, booking, note(formData)), "cancelled");
}
