"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  SOCIAL_NETWORKS,
  approveCoach,
  coachById,
  declineCoach,
  setCoachHidden,
  setCoachLocation,
  setCoachPgaVerified,
  setCoachPhotoStatus,
  setSocialLinks,
  type Coach,
  type SocialLinks,
} from "@bookon/db";
import { coachApprovedEmail, coachDeclinedEmail, createMailer } from "@bookon/email";
import { requireAdmin } from "@/lib/access";
import { webAddress } from "@/lib/club-form";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

/** Each button on the coach review page has its own action, and each checks admin access. */

async function load(formData: FormData): Promise<Coach> {
  const coach = await coachById(getDb(), String(formData.get("id") ?? ""));
  if (!coach) redirect("/admin/coaches");
  return coach!;
}

function note(formData: FormData): string | null {
  return (
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 1000) || null
  );
}

function done(id: string, query = ""): never {
  revalidatePath("/admin", "layout");
  revalidatePath("/coaches", "layout");
  redirect(`/admin/coaches/${id}${query}`);
}

/** Emails never stop an admin action; a failure is logged. */
async function send(message: Parameters<ReturnType<typeof createMailer>["send"]>[0]) {
  try {
    await createMailer(getDb()).send(message);
  } catch (error) {
    console.error("[admin] could not send email", error);
  }
}

export async function approveCoachAction(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  const message = note(formData);
  const result = await approveCoach(getDb(), coach, actor, message, new Date());
  if ("error" in result) done(coach.id, "?error=nothing");
  const live = (await coachById(getDb(), coach.id))!;
  await send(
    coachApprovedEmail({
      to: coach.email,
      name: live.profile!.name,
      firstTime: !coach.profile,
      pageLink: `${await siteOrigin()}/coaches/${live.slug}`,
      note: message,
    }),
  );
  done(coach.id, "?done=approved");
}

export async function declineCoachAction(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  const message = note(formData);
  await declineCoach(getDb(), coach, actor, message, new Date());
  await send(
    coachDeclinedEmail({
      to: coach.email,
      name: (coach.draft ?? coach.profile)?.name ?? "there",
      firstTime: !coach.profile,
      portalLink: `${await siteOrigin()}/signin?next=/coach`,
      note: message,
    }),
  );
  done(coach.id, "?done=declined");
}

export async function verifyCoachPga(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachPgaVerified(getDb(), coach, true, actor, new Date());
  done(coach.id);
}

export async function unverifyCoachPga(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachPgaVerified(getDb(), coach, false, actor, new Date());
  done(coach.id);
}

export async function hideCoach(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachHidden(getDb(), coach, true, actor, new Date());
  done(coach.id);
}

export async function showCoach(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachHidden(getDb(), coach, false, actor, new Date());
  done(coach.id);
}

export async function saveCoachLocation(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  const lat = String(formData.get("latitude") ?? "").trim();
  const lon = String(formData.get("longitude") ?? "").trim();
  if (!lat && !lon) {
    await setCoachLocation(getDb(), coach, null, actor, new Date());
    done(coach.id);
  }
  const latitude = Number(lat);
  const longitude = Number(lon);
  // Roughly Western Australia.
  if (!(latitude >= -36 && latitude <= -13 && longitude >= 112 && longitude <= 130))
    done(coach.id, "?error=location");
  await setCoachLocation(getDb(), coach, { latitude, longitude }, actor, new Date());
  done(coach.id);
}

export async function approveCoachPhoto(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachPhotoStatus(
    getDb(),
    String(formData.get("photoId")),
    "approved",
    actor,
    new Date(),
  );
  done(coach.id);
}

export async function declineCoachPhoto(formData: FormData) {
  const { actor } = await requireAdmin();
  const coach = await load(formData);
  await setCoachPhotoStatus(
    getDb(),
    String(formData.get("photoId")),
    "declined",
    actor,
    new Date(),
  );
  done(coach.id);
}

export async function saveSocialLinks(formData: FormData) {
  const { actor } = await requireAdmin();
  const links: SocialLinks = {};
  for (const network of SOCIAL_NETWORKS) {
    const value = webAddress(String(formData.get(network) ?? "").trim() || undefined);
    if (value) links[network] = value;
  }
  await setSocialLinks(getDb(), links, actor, new Date());
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}
