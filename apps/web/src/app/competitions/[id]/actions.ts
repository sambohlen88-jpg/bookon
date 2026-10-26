"use server";

import { redirect } from "next/navigation";
import { normaliseAuPhone } from "@bookon/core";
import { eventById, joinWaitlist, normaliseEmail, placesTaken } from "@bookon/db";
import { BookingProblem, PaymentError, startEntryCheckout } from "@bookon/payments";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { joinNewsletterIfTicked } from "@/lib/newsletter";

/** Enter a club event (Milestone 21): check the team, hold the places, and send them to pay. */
export async function enterEvent(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const id = field("eventId");
  const back = (problem: string): never =>
    redirect(`/competitions/${encodeURIComponent(id)}?${new URLSearchParams({ problem })}#enter`);
  const event = await eventById(getDb(), id);
  const ctx = await lessonContext();
  if (!event || !ctx) back("Entering through BookOn isn't available right now.");

  const players = Array.from({ length: event!.teamSize }, (_, i) => ({
    name: field(`player${i}`).slice(0, 80),
    memberNumber: field(`member${i}`).slice(0, 30) || undefined,
  }));
  const contactEmail = normaliseEmail(field("email"));
  const contactPhone = normaliseAuPhone(field("phone"));
  if (!players[0]!.name) back("Add your name.");
  if (!contactEmail) back("Check your email address.");
  if (!contactPhone) back("Add an Australian mobile number, like 0412 345 678.");
  if (formData.get("agree") !== "yes")
    back("Tick the box to agree to the refund rule and sharing your details with the club.");

  let url: string;
  try {
    url = await startEntryCheckout(ctx!, {
      event: event!,
      players,
      contactName: players[0]!.name,
      contactEmail: contactEmail!,
      contactPhone: contactPhone!,
      note: field("note").slice(0, 500) || undefined,
      userId: (await currentUser())?.id ?? null,
    });
  } catch (error) {
    if (error instanceof BookingProblem || error instanceof PaymentError) back(error.message);
    throw error;
  }
  await joinNewsletterIfTicked(formData, contactEmail, "event");
  redirect(url!);
}

/** Join the waiting list for a full event. */
export async function joinEventWaitlist(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const id = field("eventId");
  const page = `/competitions/${encodeURIComponent(id)}`;
  const back = (query: Record<string, string>): never =>
    redirect(`${page}?${new URLSearchParams(query)}#waitlist`);
  const db = getDb();
  const event = await eventById(db, id);
  if (!event || event.status !== "open") back({ problem: "This event isn't taking entries." });
  const name = field("name").slice(0, 80);
  const email = normaliseEmail(field("email"));
  if (!name || !email) back({ problem: "Add your name and email to join the waiting list." });
  const now = new Date();
  const left = event!.maxPlayers - ((await placesTaken(db, [event!.id], now)).get(event!.id) ?? 0);
  if (left >= event!.teamSize)
    back({ problem: "There's room now, so you can enter straight away." });
  await joinWaitlist(
    db,
    { eventId: event!.id, name, email: email!, players: event!.teamSize },
    now,
  );
  back({ waiting: "1" });
}
