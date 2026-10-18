"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addClubMember,
  approveClubApplication,
  clubApplicationById,
  clubById,
  courseBySlugForAdmin,
  decideChangeRequest,
  declineClubApplication,
  logChange,
  normaliseEmail,
  removeClubMember,
  setClubPhotoStatus,
  setCourseEnabled,
  updateCourse,
  type Course,
} from "@bookon/db";
import { isAreaId } from "@bookon/core";
import { clubApprovedEmail, clubDeclinedEmail, clubInviteEmail, createMailer } from "@bookon/email";
import { requireAdmin } from "@/lib/access";
import { webAddress } from "@/lib/club-form";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

const text = (form: FormData, name: string, max = 500): string | null => {
  const value = String(form.get(name) ?? "").trim();
  return value ? value.slice(0, max) : null;
};

/** Emails never stop an admin action; a failure is logged. */
async function send(message: Parameters<ReturnType<typeof createMailer>["send"]>[0]) {
  try {
    await createMailer(getDb()).send(message);
  } catch (error) {
    console.error("[admin] could not send email", error);
  }
}

export async function approveListing(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const id = String(formData.get("id"));
  const application = await clubApplicationById(db, id);
  if (!application) redirect("/admin/listings");
  const note = text(formData, "note", 1000);
  const result = await approveClubApplication(db, application!, actor, note, new Date());
  if ("error" in result) redirect(`/admin/listings/${id}?error=${result.error}`);
  await send(
    clubApprovedEmail({
      to: application!.contactEmail,
      name: application!.contactName,
      clubName: application!.clubName,
      signInLink: `${await siteOrigin()}/signin?next=/club`,
      note,
    }),
  );
  revalidatePath("/admin", "layout");
  redirect(`/admin/clubs/${(result as { clubId: string }).clubId}?approved=1`);
}

export async function declineListing(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const id = String(formData.get("id"));
  const application = await clubApplicationById(db, id);
  if (!application || application.status !== "submitted") redirect(`/admin/listings/${id}`);
  const note = text(formData, "note", 1000);
  await declineClubApplication(db, application!, actor, note, new Date());
  await send(
    clubDeclinedEmail({
      to: application!.contactEmail,
      name: application!.contactName,
      clubName: application!.clubName,
      note,
    }),
  );
  revalidatePath("/admin", "layout");
  redirect(`/admin/listings/${id}`);
}

async function decidePhoto(formData: FormData, approve: boolean) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const photoId = String(formData.get("photoId"));
  const courseId = text(formData, "courseId", 40);
  if (approve) {
    if (!courseId) redirect("/admin/photos?error=course");
    await setClubPhotoStatus(db, photoId, "approved", courseId);
  } else {
    await setClubPhotoStatus(db, photoId, "declined", null);
  }
  await logChange(db, actor, {
    action: approve ? "Approved a photo" : "Declined a photo",
    courseId: approve ? courseId : null,
    details: { photoId },
  });
  revalidatePath("/", "layout");
}

// One action per button, so the decision never depends on which button the browser reports.
export async function approvePhoto(formData: FormData) {
  await decidePhoto(formData, true);
}

export async function declinePhoto(formData: FormData) {
  await decidePhoto(formData, false);
}

const PLATFORMS: Course["platform"][] = ["miclub", "quick18", "chronogolf", "manual"];

export async function saveCourse(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const slug = String(formData.get("slug"));
  const course = await courseBySlugForAdmin(db, slug);
  if (!course) redirect("/admin/courses");
  const back = (error: string): never =>
    redirect(`/admin/courses/${slug}?error=${encodeURIComponent(error)}`);

  let platformConfig: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(String(formData.get("platformConfig") || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    platformConfig = parsed as Record<string, unknown>;
  } catch {
    back('The booking system settings must be JSON, like {"key": "value"}.');
  }
  const websiteUrl = webAddress(text(formData, "websiteUrl", 400) ?? undefined);
  const bookingUrl = webAddress(text(formData, "bookingUrl", 400) ?? undefined);
  if (!websiteUrl || !bookingUrl) back("Add the club website and booking page addresses.");
  const name = text(formData, "name", 120);
  const suburb = text(formData, "suburb", 80);
  if (!name || !suburb) back("Add the course name and suburb.");
  const holes = Number(formData.get("holes"));
  const window = Number(formData.get("bookingWindowDays"));
  const fee = text(formData, "typicalGreenFee", 10);
  const platform = String(formData.get("platform")) as Course["platform"];
  if (!PLATFORMS.includes(platform)) back("Choose a booking system.");
  const area = String(formData.get("area") ?? "");
  const latitude = text(formData, "latitude", 20);
  const longitude = text(formData, "longitude", 20);
  const lat = latitude === null ? null : Number(latitude);
  const lon = longitude === null ? null : Number(longitude);
  // Western Australia sits between about 13 and 36 south, 112 and 130 east.
  const inWA = (v: number | null, min: number, max: number) =>
    v !== null && Number.isFinite(v) && v >= min && v <= max;
  if (
    (lat === null) !== (lon === null) ||
    (lat !== null && (!inWA(lat, -36, -13) || !inWA(lon, 112, 130)))
  )
    back("The location should be a latitude like -32.01 and a longitude like 115.87, both in WA.");

  await updateCourse(
    db,
    course!,
    {
      name: name!,
      suburb: suburb!,
      area: isAreaId(area) ? area : null,
      latitude: lat,
      longitude: lon,
      holes: [9, 18, 27, 36].includes(holes) ? holes : course!.holes,
      websiteUrl: websiteUrl!,
      bookingUrl: bookingUrl!,
      bookingWindowDays:
        window >= 1 && window <= 60 ? Math.round(window) : course!.bookingWindowDays,
      typicalGreenFeeCents:
        fee && Number.isFinite(Number(fee)) ? Math.round(Number(fee) * 100) : null,
      notes: text(formData, "notes", 2000),
      platform,
      platformConfig: platformConfig!,
    },
    actor,
    new Date(),
  );
  revalidatePath("/", "layout");
  redirect(`/admin/courses/${slug}?saved=1`);
}

export async function toggleCourse(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const slug = String(formData.get("slug"));
  const course = await courseBySlugForAdmin(db, slug);
  if (!course) redirect("/admin/courses");
  const result = await setCourseEnabled(db, course!, formData.get("on") === "1", actor, new Date());
  revalidatePath("/", "layout");
  if ("error" in result)
    redirect(`/admin/courses/${slug}?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/courses/${slug}`);
}

export async function addMember(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const club = await clubById(db, String(formData.get("clubId")));
  if (!club) redirect("/admin/clubs");
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  if (!email) redirect(`/admin/clubs/${club!.id}?error=email`);
  const role = formData.get("role") === "owner" ? "owner" : "staff";
  await addClubMember(db, club!.id, email!, role, actor, new Date());
  await send(
    clubInviteEmail({
      to: email!,
      clubName: club!.name,
      invitedBy: "BookOn",
      role,
      signInLink: `${await siteOrigin()}/signin?next=/club`,
    }),
  );
  revalidatePath(`/admin/clubs/${club!.id}`);
}

export async function removeMember(formData: FormData) {
  const { actor } = await requireAdmin();
  const clubId = String(formData.get("clubId"));
  const result = await removeClubMember(
    getDb(),
    clubId,
    String(formData.get("email")),
    actor,
    new Date(),
  );
  if ("error" in result) redirect(`/admin/clubs/${clubId}?error=last-owner`);
  revalidatePath(`/admin/clubs/${clubId}`);
}

async function decideRequest(formData: FormData, approve: boolean) {
  const { actor } = await requireAdmin();
  await decideChangeRequest(getDb(), String(formData.get("id")), approve, actor, new Date());
  revalidatePath("/", "layout");
}

export async function approveRequest(formData: FormData) {
  await decideRequest(formData, true);
}

export async function declineRequest(formData: FormData) {
  await decideRequest(formData, false);
}
