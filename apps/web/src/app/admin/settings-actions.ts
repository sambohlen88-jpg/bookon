"use server";

import { redirect } from "next/navigation";
import { normaliseEmail, setPitchContact } from "@bookon/db";
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
