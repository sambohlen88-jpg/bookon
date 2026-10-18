"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addClubMember,
  clubProfile,
  coursesForClub,
  normaliseEmail,
  removeClubMember,
  replaceClubRates,
  requestChange,
  updateClubProfile,
} from "@bookon/db";
import { clubInviteEmail, createMailer } from "@bookon/email";
import type { RatesState } from "@/app/clubs/actions";
import { requireClub } from "@/lib/access";
import { parseClub, parseContacts, parseExtras, parseRates, parseTeeTimes } from "@/lib/club-form";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

/** Save a club's details. A new booking page goes to BookOn to check before it's used. */
export async function saveClubDetails(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const page = `/club/${clubId}/details`;
  const { club, actor } = await requireClub(clubId, page);
  const back = (error: string): never => redirect(`${page}?error=${encodeURIComponent(error)}`);
  const parsed = {
    club: parseClub(formData),
    contacts: parseContacts(formData),
    teeTimes: parseTeeTimes(formData),
  };
  for (const p of Object.values(parsed)) if ("error" in p) back(p.error);
  const value = <T>(p: { value: T } | { error: string }) => (p as { value: T }).value;
  const teeTimes = value(parsed.teeTimes);

  const db = getDb();
  const now = new Date();
  await updateClubProfile(
    db,
    club,
    {
      club: value(parsed.club),
      contacts: value(parsed.contacts),
      teeTimes,
      extras: parseExtras(formData),
    },
    actor,
    now,
  );

  const courses = await coursesForClub(db, club.id);
  const requested =
    teeTimes.bookingUrl &&
    courses.length > 0 &&
    !courses.every((c) => c.bookingUrl === teeTimes.bookingUrl) &&
    teeTimes.bookingUrl !== clubProfile(club).teeTimes?.bookingUrl;
  if (requested) {
    await requestChange(
      db,
      {
        clubId: club.id,
        courseId: courses.length === 1 ? courses[0]!.id : null,
        kind: "booking_url",
        value: teeTimes.bookingUrl!,
        requestedBy: actor.email,
      },
      now,
    );
  }
  revalidatePath(`/club/${club.id}`, "layout");
  revalidatePath("/admin", "layout");
  redirect(`${page}?saved=${requested ? "booking" : "1"}`);
}

/** Save the price list, keeping the club's edits on screen if something needs fixing. */
export async function saveClubPrices(_prev: RatesState, formData: FormData): Promise<RatesState> {
  const clubId = String(formData.get("clubId"));
  const { club, actor } = await requireClub(clubId, `/club/${clubId}/prices`);
  const parsed = parseRates(formData);
  if ("problems" in parsed) return parsed;
  await replaceClubRates(getDb(), club.id, parsed.rates, actor, new Date());
  revalidatePath(`/club/${club.id}`, "layout");
  return { saved: true };
}

async function requireOwner(clubId: string) {
  const access = await requireClub(clubId, `/club/${clubId}/team`);
  if (access.role !== "owner") redirect(`/club/${clubId}/team?error=owner`);
  return access;
}

export async function addTeamMember(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const { club, actor, user } = await requireOwner(clubId);
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  if (!email) redirect(`/club/${clubId}/team?error=email`);
  const role = formData.get("role") === "owner" ? "owner" : "staff";
  const db = getDb();
  await addClubMember(db, club.id, email!, role, actor, new Date());
  try {
    await createMailer(db).send(
      clubInviteEmail({
        to: email!,
        clubName: club.name,
        invitedBy: user.email,
        role,
        signInLink: `${await siteOrigin()}/signin?next=/club`,
      }),
    );
  } catch (error) {
    console.error("[club] could not send invite", error);
  }
  revalidatePath(`/club/${clubId}/team`);
  redirect(`/club/${clubId}/team?added=1`);
}

export async function removeTeamMember(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const { actor } = await requireOwner(clubId);
  const result = await removeClubMember(
    getDb(),
    clubId,
    String(formData.get("email")),
    actor,
    new Date(),
  );
  if ("error" in result) redirect(`/club/${clubId}/team?error=last-owner`);
  revalidatePath(`/club/${clubId}/team`);
}
