"use server";

import { redirect } from "next/navigation";
import { parsePublicHolidays, parseSchoolHolidays } from "@bookon/core";
import { normaliseEmail, setPitchContact, setWaCalendar } from "@bookon/db";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Who clubs contact, printed on pitch reports. */
export async function savePitchContact(formData: FormData) {
  const { actor } = await requireAdmin();
  const text = (name: string, max: number) =>
    String(formData.get(name) ?? "")
      .trim()
      .slice(0, max) || undefined;
  const emailText = text("email", 254);
  const email = emailText ? normaliseEmail(emailText) : null;
  if (emailText && !email) redirect("/admin/settings?error=email");
  await setPitchContact(
    getDb(),
    { name: text("name", 80), phone: text("phone", 30), email: email ?? undefined },
    actor,
    new Date(),
  );
  redirect("/admin/settings?saved=1");
}

/** WA public and school holiday dates, for coaches' special rates (Milestone 19). */
export async function saveWaCalendar(formData: FormData) {
  const { actor } = await requireAdmin();
  const publicHolidays = parsePublicHolidays(String(formData.get("publicHolidays") ?? ""));
  const schoolHolidays = parseSchoolHolidays(String(formData.get("schoolHolidays") ?? ""));
  const bad = [...publicHolidays.bad, ...schoolHolidays.bad];
  if (bad.length > 0) {
    const p = new URLSearchParams({
      error: "holidays",
      bad: bad
        .slice(0, 3)
        .map((line) => line.slice(0, 80))
        .join("\n"),
    });
    redirect(`/admin/settings?${p}#holidays`);
  }
  await setWaCalendar(
    getDb(),
    { publicHolidays: publicHolidays.list, schoolHolidays: schoolHolidays.list },
    actor,
    new Date(),
  );
  redirect("/admin/settings?saved=1#holidays");
}
