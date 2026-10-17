"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BOOKING_SYSTEMS,
  CLUB_KINDS,
  CONSENTS,
  FACILITIES,
  applicationByToken,
  applicationDetails,
  checkRate,
  listApplicationRates,
  listClubPhotos,
  normaliseEmail,
  replaceApplicationRates,
  saveApplicationDetails,
  saveConsents,
  startClubApplication,
  submitClubApplication,
  type BookingSystem,
  type ClubApplication,
  type ClubApplicationDetails,
  type ClubKind,
  type ConsentKey,
  type CourseInfo,
  type Facility,
  type Person,
  type RateInput,
} from "@bookon/db";
import {
  clubApplicationNotice,
  clubLinkEmail,
  clubSubmittedEmail,
  createMailer,
} from "@bookon/email";
import { clubStepHref, isClubStep, nextClubStep, type ClubStep } from "@/lib/club-steps";
import { getDb } from "@/lib/db";
import { ownerEmail, siteOrigin } from "@/lib/site";

const str = (form: FormData, name: string, max = 200): string | undefined => {
  const value = String(form.get(name) ?? "").trim();
  return value ? value.slice(0, max) : undefined;
};
const num = (form: FormData, name: string, min: number, max: number): number | undefined => {
  const value = Number(form.get(name));
  return form.get(name) && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
};
const time = (form: FormData, name: string): string | undefined => {
  const value = str(form, name, 5);
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
};
const yesNo = (form: FormData, name: string): boolean | undefined =>
  form.get(name) === "yes" ? true : form.get(name) === "no" ? false : undefined;

function webAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function person(form: FormData, prefix: string): Person | undefined {
  const name = str(form, `${prefix}Name`, 120);
  const email = normaliseEmail(String(form.get(`${prefix}Email`) ?? "")) ?? undefined;
  const phone = str(form, `${prefix}Phone`, 40);
  const role = str(form, `${prefix}Role`, 80);
  if (!name && !email && !phone) return undefined;
  return { name: name ?? "", email: email ?? "", phone, role };
}

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

  if (step === "club") {
    const name = str(formData, "name", 120);
    const suburb = str(formData, "suburb", 80);
    if (!name || !suburb) back(token, step, "Add your club's name and suburb.");
    const abn = str(formData, "abn", 20)?.replace(/\s/g, "");
    if (abn && !/^\d{11}$/.test(abn)) back(token, step, "An ABN has 11 digits.");
    const postcode = str(formData, "postcode", 4);
    if (postcode && !/^\d{4}$/.test(postcode)) back(token, step, "A postcode has 4 digits.");
    const kind = str(formData, "kind") as ClubKind | undefined;
    patch = {
      club: {
        name: name!,
        legalName: str(formData, "legalName", 160),
        abn,
        kind: kind && kind in CLUB_KINDS ? kind : undefined,
        website: webAddress(str(formData, "website")),
        phone: str(formData, "phone", 40),
        publicEmail: normaliseEmail(String(formData.get("publicEmail") ?? "")) ?? undefined,
        street: str(formData, "street", 160),
        suburb: suburb!,
        postcode,
        state: str(formData, "state", 3) ?? "WA",
      },
    };
  }

  if (step === "contacts") {
    const main = person(formData, "main");
    if (!main?.name || !main.email) back(token, step, "Add a main contact's name and email.");
    patch = {
      contacts: {
        main: main!,
        bookings: person(formData, "bookings"),
        accounts: person(formData, "accounts"),
        reportsEmail: normaliseEmail(String(formData.get("reportsEmail") ?? "")) ?? undefined,
      },
    };
  }

  if (step === "courses") {
    let rows: unknown;
    try {
      rows = JSON.parse(String(formData.get("courses") ?? "[]"));
    } catch {
      rows = [];
    }
    const courses: CourseInfo[] = (Array.isArray(rows) ? rows : [])
      .slice(0, 10)
      .map((r: Record<string, unknown>) => ({
        name: String(r.name ?? "")
          .trim()
          .slice(0, 120),
        holes: [9, 18, 27, 36].includes(Number(r.holes)) ? Number(r.holes) : 0,
        par: Number(r.par) >= 27 && Number(r.par) <= 80 ? Number(r.par) : undefined,
        layouts:
          String(r.layouts ?? "")
            .trim()
            .slice(0, 200) || undefined,
      }))
      .filter((c) => c.name);
    if (courses.length === 0) back(token, step, "Add at least one course.");
    if (courses.some((c) => !c.holes)) back(token, step, "Choose how many holes each course has.");
    patch = { courses };
  }

  if (step === "tee-times") {
    const bookingSystem = str(formData, "bookingSystem") as BookingSystem | undefined;
    if (!bookingSystem || !(bookingSystem in BOOKING_SYSTEMS))
      back(token, step, "Choose how golfers book.");
    const bookingUrl = webAddress(str(formData, "bookingUrl", 400));
    if (str(formData, "bookingUrl") && !bookingUrl)
      back(token, step, "That booking page address doesn't look right.");
    patch = {
      teeTimes: {
        bookingSystem: bookingSystem!,
        bookingSystemOther: str(formData, "bookingSystemOther", 120),
        bookingUrl,
        intervalMinutes: num(formData, "intervalMinutes", 4, 30),
        weekdayFirst: time(formData, "weekdayFirst"),
        weekdayLast: time(formData, "weekdayLast"),
        weekendFirst: time(formData, "weekendFirst"),
        weekendLast: time(formData, "weekendLast"),
        windowDays: num(formData, "windowDays", 1, 365),
        twoTeeStarts: yesNo(formData, "twoTeeStarts"),
        maxPlayers: num(formData, "maxPlayers", 1, 6),
        singlesWelcome: yesNo(formData, "singlesWelcome"),
        memberTimes: str(formData, "memberTimes", 1000),
        cancellationPolicy: str(formData, "cancellationPolicy", 1000),
        dressCode: str(formData, "dressCode", 500),
      },
    };
  }

  if (step === "extras") {
    patch = {
      extras: {
        description: str(formData, "description", 800),
        facilities: formData
          .getAll("facilities")
          .map(String)
          .filter((f): f is Facility => f in FACILITIES),
      },
    };
  }

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

export type RatesState = { problems: string[] } | null;

/** Save the price list. Returns problems to show beside the form, keeping the club's edits. */
export async function saveClubRates(_prev: RatesState, formData: FormData): Promise<RatesState> {
  const token = String(formData.get("token") ?? "");
  const application = await load(token);
  if (application.status !== "draft") redirect(clubStepHref(token, "review"));
  let rows: unknown;
  try {
    rows = JSON.parse(String(formData.get("rates") ?? "[]"));
  } catch {
    return { problems: ["Something went wrong reading the prices. Try again."] };
  }
  const checked = (Array.isArray(rows) ? rows : []).map((r) =>
    checkRate(r as Record<string, unknown>),
  );
  const problems = checked.flatMap((c) => ("problem" in c ? [c.problem] : []));
  if (problems.length > 0) return { problems };
  const rates = checked as RateInput[];
  if (!rates.some((r) => r.category === "green_fee")) {
    return { problems: ["Add at least one green fee, so golfers know what a round costs."] };
  }
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
