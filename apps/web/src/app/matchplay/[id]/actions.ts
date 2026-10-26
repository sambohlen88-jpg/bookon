"use server";

import { redirect } from "next/navigation";
import { normaliseAuPhone } from "@bookon/core";
import { compById, normaliseEmail } from "@bookon/db";
import { BookingProblem, PaymentError, startMpEntry } from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { joinNewsletterIfTicked } from "@/lib/newsletter";

/** Enter a match play competition online (Milestone 22): free entries go straight in, paid ones to pay. */
export async function enterMatchplay(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const id = field("compId");
  const back = (problem: string): never =>
    redirect(`/matchplay/${encodeURIComponent(id)}?${new URLSearchParams({ problem })}#enter`);
  const comp = await compById(getDb(), id);
  const ctx = await lessonContext();
  if (!comp || !ctx) back("Entering through BookOn isn't available right now.");

  const players = Array.from({ length: comp!.teamSize }, (_, i) => ({
    name: field(`player${i}`).slice(0, 80),
  }));
  const contactEmail = normaliseEmail(field("email"));
  const contactPhone = normaliseAuPhone(field("phone"));
  if (players.some((p) => !p.name))
    back(comp!.teamSize === 2 ? "Add both players' names." : "Add your name.");
  if (!contactEmail) back("Check your email address.");
  if (!contactPhone) back("Add an Australian mobile number, like 0412 345 678.");
  if (formData.get("agree") !== "yes")
    back("Tick the box to agree to sharing your contact details with your opponents and the club.");

  let url: string;
  try {
    url = await startMpEntry(ctx!, {
      comp: comp!,
      players,
      contactEmail: contactEmail!,
      contactPhone: contactPhone!,
      userId: (await currentUser())?.id ?? null,
    });
  } catch (error) {
    if (error instanceof BookingProblem || error instanceof PaymentError) back(error.message);
    throw error;
  }
  await joinNewsletterIfTicked(formData, contactEmail, "matchplay");
  redirect(url!);
}
