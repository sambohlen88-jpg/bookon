"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listCourseDetails, saveCoachDraft, submitCoach } from "@bookon/db";
import { coachSubmittedEmail, createMailer } from "@bookon/email";
import { currentUser } from "@/lib/auth";
import { parseCoachForm } from "@/lib/coach-form";
import { getDb } from "@/lib/db";
import { ownerEmail, siteOrigin } from "@/lib/site";

async function signedIn() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach");
  return user!;
}

/** Save what the coach typed. Problems come back to the page to fix, but nothing typed is lost. */
async function save(formData: FormData) {
  const user = await signedIn();
  const db = getDb();
  const { profile, problems } = parseCoachForm(formData, await listCourseDetails(db));
  if (!profile.name) profile.name = user.email.split("@")[0]!;
  const consentBy = String(formData.get("consentBy") ?? "").trim();
  const consent = formData.get("consent") === "yes" && consentBy ? { by: consentBy } : undefined;
  const coach = await saveCoachDraft(db, user.email, profile, new Date(), consent);
  return { coach, problems, consented: Boolean(consent || coach.consents.public) };
}

function back(query: Record<string, string>): never {
  redirect(`/coach?${new URLSearchParams(query)}#listing`);
}

export async function saveCoachListing(formData: FormData) {
  const { problems } = await save(formData);
  revalidatePath("/coach");
  back(problems.length ? { problems: JSON.stringify(problems) } : { saved: "1" });
}

export async function sendCoachListing(formData: FormData) {
  const { coach, problems, consented } = await save(formData);
  if (!consented)
    problems.push("Tick the box to say BookOn may show your details, and add your name.");
  if (problems.length) back({ problems: JSON.stringify(problems) });
  const now = new Date();
  await submitCoach(getDb(), coach.id, now);
  try {
    await createMailer(getDb()).send(
      coachSubmittedEmail({
        to: ownerEmail(),
        coachName: coach.draft?.name ?? coach.email,
        coachEmail: coach.email,
        changes: Boolean(coach.profile),
        reviewLink: `${await siteOrigin()}/admin/coaches/${coach.id}`,
      }),
    );
  } catch (error) {
    console.error("[coach] could not email the reviewer", error);
  }
  revalidatePath("/coach");
  back({ sent: "1" });
}
