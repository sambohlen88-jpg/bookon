"use server";

import { redirect } from "next/navigation";
import { parsePriceCents } from "@bookon/core";
import { eventPaymentSettings, setEventPaymentSettings } from "@bookon/db";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Club event payments in Admin, Settings (Milestone 21). */

export async function turnEventPaymentsOn() {
  const { actor } = await requireAdmin();
  const db = getDb();
  const settings = await eventPaymentSettings(db);
  await setEventPaymentSettings(db, { ...settings, enabled: true }, actor, new Date());
  redirect("/admin/settings?saved=1#event-payments");
}

export async function turnEventPaymentsOff() {
  const { actor } = await requireAdmin();
  const db = getDb();
  const settings = await eventPaymentSettings(db);
  await setEventPaymentSettings(db, { ...settings, enabled: false }, actor, new Date());
  redirect("/admin/settings?saved=1#event-payments");
}

/** The booking fee golfers pay on top of each event entry. New entries only. */
export async function saveEventBookingFee(formData: FormData) {
  const { actor } = await requireAdmin();
  const text = String(formData.get("fee") ?? "").trim();
  const feeCents = parsePriceCents(text.startsWith("$") ? text : `$${text}`);
  if (feeCents === null || feeCents < 0 || feeCents > 5000)
    redirect("/admin/settings?error=fee#event-payments");
  const db = getDb();
  const settings = await eventPaymentSettings(db);
  await setEventPaymentSettings(db, { ...settings, feeCents: feeCents! }, actor, new Date());
  redirect("/admin/settings?saved=1#event-payments");
}
