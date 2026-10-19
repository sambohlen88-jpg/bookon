"use server";

import { redirect } from "next/navigation";
import { parsePriceCents } from "@bookon/core";
import { lessonPaymentSettings, setLessonPaymentSettings } from "@bookon/db";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Lesson payments in Admin, Settings (Milestone 15). */

export async function turnLessonPaymentsOn() {
  const { actor } = await requireAdmin();
  const db = getDb();
  const settings = await lessonPaymentSettings(db);
  await setLessonPaymentSettings(db, { ...settings, enabled: true }, actor, new Date());
  redirect("/admin/settings?saved=1#lesson-payments");
}

export async function turnLessonPaymentsOff() {
  const { actor } = await requireAdmin();
  const db = getDb();
  const settings = await lessonPaymentSettings(db);
  await setLessonPaymentSettings(db, { ...settings, enabled: false }, actor, new Date());
  redirect("/admin/settings?saved=1#lesson-payments");
}

/** The booking fee golfers pay on top of each lesson. Changes apply to new bookings only. */
export async function saveBookingFee(formData: FormData) {
  const { actor } = await requireAdmin();
  const text = String(formData.get("fee") ?? "").trim();
  const feeCents = parsePriceCents(text.startsWith("$") ? text : `$${text}`);
  if (feeCents === null || feeCents < 0 || feeCents > 5000)
    redirect("/admin/settings?error=fee#lesson-payments");
  const db = getDb();
  const settings = await lessonPaymentSettings(db);
  await setLessonPaymentSettings(db, { ...settings, feeCents: feeCents! }, actor, new Date());
  redirect("/admin/settings?saved=1#lesson-payments");
}
