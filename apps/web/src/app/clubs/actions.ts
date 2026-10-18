"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CONSENTS,
  applicationByToken,
  applicationDetails,
  listApplicationRates,
  listClubPhotos,
  normaliseEmail,
  replaceApplicationRates,
  saveApplicationDetails,
  saveConsents,
  startClubApplication,
  submitClubApplication,
  type ClubApplication,
  type ClubApplicationDetails,
  type ConsentKey,
} from "@bookon/db";
import {
  clubApplicationNotice,
  clubLinkEmail,
  clubSubmittedEmail,
  createMailer,
} from "@bookon/email";
import {
  parseClub,
  parseContacts,
  parseCourses,
  parseExtras,
  parseRates,
  parseTeeTimes,
  str as readStr,
  type Parsed,
} from "@/lib/club-form";
import { clubStepHref, isClubStep, nextClubStep, type ClubStep } from "@/lib/club-steps";
import { getDb } from "@/lib/db";
import { ownerEmail, siteOrigin } from "@/lib/site";

const str = (form: FormData, name: string, max = 200) => readStr(form, name, max);
const yesNo = (form: FormData, name: string): boolean | undefined =>
  form.get(name) === "yes" ? true : form.get(name) === "no" ? false : undefined;

async function load(token: string): Promise<ClubApplication> {
  const application = await applicationByToken(getDb(), token);
  if (!application) redirect("/clubs/join?error=link");
  return application!;
}

function back(token: string, step: ClubStep, error: string): never {
  redirect(`${clubStepHref(token, step)}?error=${encodeURIComponent(error)}`);
}

/** Start a listing: saves the basics and emails the club its private link. */
export async function startClubListing(formData: FormData) {
  // Bots fill in every field, including this hidden one.
  if (str(formData, "website")) redirect("/clubs/join?error=check");
  const clubName = str(formData, "clubName", 120);
  const contactName = str(formData, "contactName", 120);
  const suburb = str(formData, "suburb", 80);
  const contactEmail = normaliseEmail(String(formData.get("contactEmail") ?? ""));
  if (!clubName || !contactName || !contactEmail) redirect("/clubs/join?error=missing");

  const db = getDb();
  const result = await startClubApplication(
    db,
    { clubName: clubName!, contactName: contactName!, contactEmail: contactEmail!, suburb },
    new Date(),
  );
  if ("error" in result) redirect("/clubs/join?error=limit");
  const { token } = result as { token: string };
  await createMailer(db).send(
    clubLinkEmail({
      to: contactEmail!,
      name: contactName!,
      clubName: clubName!,
      link: `${await siteOrigin()}/clubs/join/${token}`,
    }),
  );
  redirect(clubStepHref(token, "club"));
}

/** Save one step of the listing and go to the next. */
export async function saveClubStep(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const step = String(formData.get("step") ?? "");
  if (!isClubStep(step)) redirect("/clubs/join");
  const application = await load(token);
  if (application.status !== "draft") redirect(clubStepHref(token, "review"));
  const db = getDb();
  const now = new Date();
  const details = applicationDetails(application);
  let patch: ClubApplicationDetails = {};

  const read = <T>(parsed: Parsed<T>): T =>
    "error" in parsed ? back(token, step, parsed.error) : parsed.value;
  if (step === "club") patch = { club: read(parseClub(formData)) };
  if (step === "contacts") patch = { contacts: read(parseContacts(formData)) };
  if (step === "courses") patch = { courses: read(parseCourses(formData)) };
  if (step === "tee-times") patch = { teeTimes: read(parseTeeTimes(formData)) };
  if (step === "extras") patch = { extras: parseExtras(formData) };

  if (step === "approvals") {
    const by = str(formData, "by", 120);
    if (!by) back(token, step, "Add your name, so we know who gave these approvals.");
    const accepted = formData
      .getAll("consent")
      .map(String)
      .filter((k): k is ConsentKey => k in CONSENTS);
    const interest = str(formData, "paymentsInterest");
    await saveConsents(
      db,
      application,
      {
        accepted,
        by: by!,
        role: str(formData, "role", 80),
        paymentsInterest:
          interest === "yes" || interest === "maybe" || interest === "no" ? interest : null,
        payments: {
          gstRegistered: yesNo(formData, "gstRegistered"),
          payoutBusinessName: str(formData, "payoutBusinessName", 160),
        },
      },
      now,
    );
    const missing = (Object.keys(CONSENTS) as ConsentKey[]).filter(
      (k) => CONSENTS[k].required && !accepted.includes(k),
    );
    if (missing.length > 0)
      back(
        token,
        step,
        "Tick each approval marked required. We can't list your club without them.",
      );
    redirect(clubStepHref(token, nextClubStep(step)));
  }

  if (Object.keys(patch).length > 0) {
    await saveApplicationDetails(db, application, { ...details, ...patch }, now);
  }
  redirect(clubStepHref(token, nextClubStep(step)));
}

export type RatesState = { problems: string[] } | { saved: true } | null;

/** Save the price list. Returns problems to show beside the form, keeping the club's edits. */
export async function saveClubRates(_prev: RatesState, formData: FormData): Promise<RatesState> {
  const token = String(formData.get("token") ?? "");
  const application = await load(token);
  if (application.status !== "draft") redirect(clubStepHref(token, "review"));
  const parsed = parseRates(formData);
  if ("problems" in parsed) return parsed;
  const { rates } = parsed;
  await replaceApplicationRates(getDb(), application, rates, new Date());
  redirect(clubStepHref(token, "extras"));
}

/** Send the listing to BookOn, and confirm it to the club. */
export async function submitClubListing(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const application = await load(token);
  const db = getDb();
  const now = new Date();
  const result = await submitClubApplication(db, application, now);
  if ("problems" in result) back(token, "review", `Still needed: ${result.problems.join(", ")}.`);

  const site = await siteOrigin();
  const sent = (await applicationByToken(db, token))!;
  const mailer = createMailer(db);
  // The listing is saved either way; a failed email is logged, not shown as a failed send.
  try {
    await mailer.send(
      clubSubmittedEmail({
        to: sent.contactEmail,
        name: sent.contactName,
        clubName: sent.clubName,
        link: `${site}/clubs/join/${token}`,
      }),
    );
    await mailer.send(
      clubApplicationNotice({
        to: ownerEmail(),
        application: sent,
        rates: await listApplicationRates(db, sent.id),
        photoCount: (await listClubPhotos(db, sent.id)).length,
      }),
    );
  } catch (error) {
    console.error("[clubs] could not send listing emails", error);
  }
  revalidatePath(`/clubs/join/${token}`);
  redirect(`${clubStepHref(token, "review")}?sent=1`);
}
