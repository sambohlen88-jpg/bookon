import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray } from "drizzle-orm";
import { hashToken } from "./accounts";
import type { Database } from "./client";
import { clubApplications, clubPhotos, clubRates } from "./schema";

/* Club onboarding: a club fills this in over one or more visits, then sends it to BookOn. */

export type ClubApplication = typeof clubApplications.$inferSelect;
export type ClubApplicationStatus = ClubApplication["status"];
export type ClubRate = typeof clubRates.$inferSelect;

/** New applications one email address can start in a day, so the form can't be used to spam. */
export const APPLICATIONS_PER_DAY = 5;
/** Photos per application. */
export const MAX_CLUB_PHOTOS = 8;
/** Price list lines per application. */
export const MAX_CLUB_RATES = 80;

export const CLUB_KINDS = {
  public: "Public course",
  members_open: "Members' club open to the public",
  resort: "Resort course",
  other: "Something else",
} as const;
export type ClubKind = keyof typeof CLUB_KINDS;

export const BOOKING_SYSTEMS = {
  miclub: "MiClub",
  quick18: "Quick18",
  chronogolf: "Chronogolf (Lightspeed Golf)",
  golfgenius: "Golf Genius",
  own_website: "Our own website",
  phone: "Phone or walk-in only",
  other: "Something else",
} as const;
export type BookingSystem = keyof typeof BOOKING_SYSTEMS;

export const FACILITIES = {
  pro_shop: "Pro shop",
  driving_range: "Driving range",
  practice_green: "Practice putting green",
  short_game: "Chipping and bunker practice",
  carts: "Motorised carts",
  trolleys: "Buggies and trolleys",
  club_hire: "Club hire",
  lessons: "Lessons",
  cafe: "Café",
  bar: "Bar",
  restaurant: "Restaurant",
  functions: "Function room",
  night_golf: "Night golf",
  mini_golf: "Mini golf",
  accessible: "Accessible carts or facilities",
} as const;
export type Facility = keyof typeof FACILITIES;

export interface Person {
  name: string;
  role?: string;
  email: string;
  phone?: string;
}

export interface CourseInfo {
  name: string;
  holes: number;
  par?: number;
  /** Nines or loops golfers can book, e.g. "Island & Pines". */
  layouts?: string;
}

/** Everything a club tells us apart from prices, photos and approvals. */
export interface ClubApplicationDetails {
  club?: {
    name: string;
    legalName?: string;
    abn?: string;
    kind?: ClubKind;
    website?: string;
    phone?: string;
    publicEmail?: string;
    street?: string;
    suburb: string;
    postcode?: string;
    state: string;
  };
  contacts?: {
    main: Person;
    bookings?: Person;
    accounts?: Person;
    /** Where monthly reports go. */
    reportsEmail?: string;
  };
  courses?: CourseInfo[];
  teeTimes?: {
    bookingSystem: BookingSystem;
    bookingSystemOther?: string;
    bookingUrl?: string;
    /** Minutes between tee times. */
    intervalMinutes?: number;
    weekdayFirst?: string;
    weekdayLast?: string;
    weekendFirst?: string;
    weekendLast?: string;
    /** How many days ahead the public can book. */
    windowDays?: number;
    twoTeeStarts?: boolean;
    maxPlayers?: number;
    singlesWelcome?: boolean;
    /** Times the public can't book, such as member competitions. */
    memberTimes?: string;
    cancellationPolicy?: string;
    dressCode?: string;
  };
  extras?: {
    description?: string;
    facilities?: Facility[];
  };
  payments?: {
    gstRegistered?: boolean;
    /** The account name payouts would go to, collected again securely when payments start. */
    payoutBusinessName?: string;
  };
}

export const CONSENTS_VERSION = "2026-10-18";

/** What a club agrees to. The wording is saved with each approval. */
export const CONSENTS = {
  authorised: {
    required: true,
    text: "I'm authorised to list this club on BookOn and agree to these things on its behalf.",
  },
  show_times: {
    required: true,
    text: "BookOn may show our available tee times, prices and course details, and send golfers to our booking page to book and pay.",
  },
  read_booking_page: {
    required: true,
    text: "BookOn may read our public booking page automatically to keep times up to date, no more than once every few seconds and identifying itself as BookOnBot.",
  },
  provider_access: {
    required: false,
    text: "We're happy for BookOn to ask our booking system provider for a data feed of our tee times, and we'll confirm it with them if asked.",
  },
  listing_terms: {
    required: true,
    text: "We've read the listing terms on this page: listing is free, we can update or remove our listing at any time, and BookOn shares activity reports with us.",
  },
  news: {
    required: false,
    text: "Send us occasional BookOn news, such as when online payments become available.",
  },
} as const;
export type ConsentKey = keyof typeof CONSENTS;

export interface ConsentRecord {
  accepted: boolean;
  text: string;
  version: string;
  by: string;
  role?: string;
  at: string;
}

export interface RateInput {
  courseName?: string | null;
  category: ClubRate["category"];
  name: string;
  holes?: number | null;
  days: ClubRate["days"];
  daysOfWeek?: number[] | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  player: ClubRate["player"];
  priceCents: number;
  unit: ClubRate["unit"];
  gstIncluded: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  notes?: string | null;
}

const CATEGORIES = [
  "green_fee",
  "cart",
  "club_hire",
  "trolley",
  "range",
  "deal",
  "membership",
  "other",
] as const;
const DAYS = ["any", "weekday", "weekend", "public_holiday", "custom"] as const;
const PLAYERS = [
  "any",
  "adult",
  "senior",
  "concession",
  "junior",
  "student",
  "member_guest",
] as const;
const UNITS = ["per_player", "per_cart", "per_set", "per_group", "per_item"] as const;

const isTime = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * Check one price line from the form. Returns the cleaned line, or what's
 * wrong in words the club will understand.
 */
export function checkRate(raw: Record<string, unknown>): RateInput | { problem: string } {
  const name = text(raw.name, 120);
  if (!name) return { problem: "Give each price a name, such as “18 holes weekday”." };
  const category = CATEGORIES.find((c) => c === raw.category);
  const days = DAYS.find((d) => d === raw.days) ?? "any";
  const player = PLAYERS.find((p) => p === raw.player) ?? "any";
  const unit = UNITS.find((u) => u === raw.unit) ?? "per_player";
  if (!category) return { problem: `Choose what “${name}” is for.` };
  const price =
    typeof raw.price === "number"
      ? raw.price
      : Number(String(raw.price ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 0 || price > 100_000) {
    return { problem: `Enter a price in dollars for “${name}”, such as 42.50.` };
  }
  const holes =
    raw.holes === 9 || raw.holes === "9" ? 9 : raw.holes === 18 || raw.holes === "18" ? 18 : null;
  const daysOfWeek =
    days === "custom" && Array.isArray(raw.daysOfWeek)
      ? [...new Set(raw.daysOfWeek.map(Number).filter((d) => d >= 1 && d <= 7))].sort()
      : null;
  if (days === "custom" && (!daysOfWeek || daysOfWeek.length === 0)) {
    return { problem: `Tick the days “${name}” applies on.` };
  }
  const timeFrom = isTime(raw.timeFrom) ? raw.timeFrom : null;
  const timeTo = isTime(raw.timeTo) ? raw.timeTo : null;
  if (timeFrom && timeTo && timeFrom >= timeTo) {
    return { problem: `The start time for “${name}” should be before its end time.` };
  }
  const validFrom = isDate(raw.validFrom) ? raw.validFrom : null;
  const validTo = isDate(raw.validTo) ? raw.validTo : null;
  if (validFrom && validTo && validFrom > validTo) {
    return { problem: `The first date for “${name}” should be before its last date.` };
  }
  return {
    courseName: text(raw.courseName, 120),
    category,
    name,
    holes,
    days,
    daysOfWeek,
    timeFrom,
    timeTo,
    player,
    priceCents: Math.round(price * 100),
    unit,
    gstIncluded: raw.gstIncluded !== false,
    validFrom,
    validTo,
    notes: text(raw.notes, 500),
  };
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Start an application. Returns the private link token, or refuses after too many today. */
export async function startClubApplication(
  db: Database,
  input: { clubName: string; contactName: string; contactEmail: string; suburb?: string },
  now: Date,
): Promise<{ token: string; application: ClubApplication } | { error: "limit" }> {
  const [recent] = await db
    .select({ n: count() })
    .from(clubApplications)
    .where(
      and(
        eq(clubApplications.contactEmail, input.contactEmail),
        gt(clubApplications.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    );
  if ((recent?.n ?? 0) >= APPLICATIONS_PER_DAY) return { error: "limit" };
  const token = newToken();
  const details: ClubApplicationDetails = {
    club: { name: input.clubName, suburb: input.suburb ?? "", state: "WA" },
    contacts: { main: { name: input.contactName, email: input.contactEmail } },
  };
  const [application] = await db
    .insert(clubApplications)
    .values({
      createdAt: now,
      updatedAt: now,
      resumeTokenHash: hashToken(token),
      clubName: input.clubName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      details: details as Record<string, unknown>,
    })
    .returning();
  return { token, application: application! };
}

export async function applicationByToken(
  db: Database,
  token: string,
): Promise<ClubApplication | null> {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select()
    .from(clubApplications)
    .where(eq(clubApplications.resumeTokenHash, hashToken(token)));
  return row ?? null;
}

export function applicationDetails(application: ClubApplication): ClubApplicationDetails {
  return application.details as ClubApplicationDetails;
}

export function applicationConsents(
  application: ClubApplication,
): Partial<Record<ConsentKey, ConsentRecord>> {
  return application.consents as Partial<Record<ConsentKey, ConsentRecord>>;
}

/** Only drafts can be changed; once sent, changes go through BookOn. */
function editable(application: ClubApplication): boolean {
  return application.status === "draft";
}

/** Save one or more sections of the form. */
export async function saveApplicationDetails(
  db: Database,
  application: ClubApplication,
  patch: ClubApplicationDetails,
  now: Date,
): Promise<boolean> {
  if (!editable(application)) return false;
  const details = { ...applicationDetails(application), ...patch };
  await db
    .update(clubApplications)
    .set({
      details: details as Record<string, unknown>,
      updatedAt: now,
      clubName: details.club?.name ?? application.clubName,
      contactName: details.contacts?.main.name ?? application.contactName,
      contactEmail: details.contacts?.main.email ?? application.contactEmail,
    })
    .where(eq(clubApplications.id, application.id));
  return true;
}

/** Replace the club's price list with these lines, in this order. */
export async function replaceApplicationRates(
  db: Database,
  application: ClubApplication,
  rates: RateInput[],
  now: Date,
): Promise<boolean> {
  if (!editable(application)) return false;
  await db.transaction(async (tx) => {
    await tx.delete(clubRates).where(eq(clubRates.applicationId, application.id));
    if (rates.length > 0) {
      await tx.insert(clubRates).values(
        rates.slice(0, MAX_CLUB_RATES).map((r, i) => ({
          ...r,
          applicationId: application.id,
          sort: i,
        })),
      );
    }
    await tx
      .update(clubApplications)
      .set({ updatedAt: now })
      .where(eq(clubApplications.id, application.id));
  });
  return true;
}

export async function listApplicationRates(
  db: Database,
  applicationId: string,
): Promise<ClubRate[]> {
  return db
    .select()
    .from(clubRates)
    .where(eq(clubRates.applicationId, applicationId))
    .orderBy(asc(clubRates.sort));
}

/** Record the approvals ticked, with the wording shown, who gave them and when. */
export async function saveConsents(
  db: Database,
  application: ClubApplication,
  input: {
    accepted: ConsentKey[];
    by: string;
    role?: string;
    paymentsInterest: "yes" | "maybe" | "no" | null;
    payments?: ClubApplicationDetails["payments"];
  },
  now: Date,
): Promise<boolean> {
  if (!editable(application)) return false;
  const consents = Object.fromEntries(
    (Object.keys(CONSENTS) as ConsentKey[]).map((key) => [
      key,
      {
        accepted: input.accepted.includes(key),
        text: CONSENTS[key].text,
        version: CONSENTS_VERSION,
        by: input.by,
        role: input.role,
        at: now.toISOString(),
      } satisfies ConsentRecord,
    ]),
  );
  await db
    .update(clubApplications)
    .set({
      consents,
      paymentsInterest: input.paymentsInterest,
      details: { ...applicationDetails(application), payments: input.payments } as Record<
        string,
        unknown
      >,
      updatedAt: now,
    })
    .where(eq(clubApplications.id, application.id));
  return true;
}

/** What still needs filling in before the club can send it. Empty when ready. */
export function applicationProblems(application: ClubApplication, rates: ClubRate[]): string[] {
  const d = applicationDetails(application);
  const consents = applicationConsents(application);
  const problems: string[] = [];
  if (!d.club?.name || !d.club.suburb) problems.push("Your club's name and suburb");
  if (!d.contacts?.main.name || !d.contacts.main.email) problems.push("A main contact");
  if (!d.courses?.length) problems.push("At least one course");
  if (!d.teeTimes?.bookingSystem) problems.push("How golfers book");
  if (!rates.some((r) => r.category === "green_fee")) problems.push("At least one green fee");
  const missing = (Object.keys(CONSENTS) as ConsentKey[]).filter(
    (k) => CONSENTS[k].required && !consents[k]?.accepted,
  );
  if (missing.length > 0) problems.push("The approvals");
  return problems;
}

/** Send the application to BookOn. Refused while anything required is missing. */
export async function submitClubApplication(
  db: Database,
  application: ClubApplication,
  now: Date,
): Promise<{ ok: true } | { problems: string[] }> {
  if (!editable(application)) return { problems: ["This has already been sent."] };
  const problems = applicationProblems(application, await listApplicationRates(db, application.id));
  if (problems.length > 0) return { problems };
  await db
    .update(clubApplications)
    .set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(and(eq(clubApplications.id, application.id), eq(clubApplications.status, "draft")));
  return { ok: true };
}

export async function listClubApplications(
  db: Database,
  statuses?: ClubApplicationStatus[],
): Promise<ClubApplication[]> {
  return db
    .select()
    .from(clubApplications)
    .where(statuses ? inArray(clubApplications.status, statuses) : undefined)
    .orderBy(desc(clubApplications.updatedAt));
}

export async function clubApplicationById(
  db: Database,
  id: string,
): Promise<ClubApplication | null> {
  const [row] = await db.select().from(clubApplications).where(eq(clubApplications.id, id));
  return row ?? null;
}

/** BookOn's decision. Approving doesn't switch a course on: that still needs its booking page set up. */
export async function setClubApplicationStatus(
  db: Database,
  id: string,
  status: "approved" | "declined" | "withdrawn" | "draft",
  notes: string | null,
  now: Date,
): Promise<void> {
  await db
    .update(clubApplications)
    .set({ status, reviewNotes: notes, updatedAt: now })
    .where(eq(clubApplications.id, id));
}

/* Photos */

export type ClubPhotoInfo = Omit<typeof clubPhotos.$inferSelect, "data">;

const photoInfo = {
  id: clubPhotos.id,
  applicationId: clubPhotos.applicationId,
  courseId: clubPhotos.courseId,
  createdAt: clubPhotos.createdAt,
  status: clubPhotos.status,
  contentType: clubPhotos.contentType,
  width: clubPhotos.width,
  height: clubPhotos.height,
  caption: clubPhotos.caption,
  credit: clubPhotos.credit,
  rightsConfirmedBy: clubPhotos.rightsConfirmedBy,
};

export async function addClubPhoto(
  db: Database,
  application: ClubApplication,
  photo: {
    contentType: string;
    width: number;
    height: number;
    data: Buffer;
    caption?: string | null;
    credit?: string | null;
    rightsConfirmedBy: string;
  },
  now: Date,
): Promise<{ id: string } | { error: "limit" | "locked" }> {
  if (!editable(application)) return { error: "locked" };
  const [existing] = await db
    .select({ n: count() })
    .from(clubPhotos)
    .where(eq(clubPhotos.applicationId, application.id));
  if ((existing?.n ?? 0) >= MAX_CLUB_PHOTOS) return { error: "limit" };
  const [row] = await db
    .insert(clubPhotos)
    .values({
      applicationId: application.id,
      createdAt: now,
      contentType: photo.contentType,
      width: photo.width,
      height: photo.height,
      data: photo.data,
      caption: photo.caption?.slice(0, 200) ?? null,
      credit: photo.credit?.slice(0, 120) ?? null,
      rightsConfirmedBy: photo.rightsConfirmedBy.slice(0, 120),
    })
    .returning({ id: clubPhotos.id });
  return { id: row!.id };
}

export async function listClubPhotos(
  db: Database,
  applicationId: string,
): Promise<ClubPhotoInfo[]> {
  return db
    .select(photoInfo)
    .from(clubPhotos)
    .where(eq(clubPhotos.applicationId, applicationId))
    .orderBy(asc(clubPhotos.createdAt));
}

export async function clubPhotoById(
  db: Database,
  id: string,
): Promise<(ClubPhotoInfo & { data: Buffer }) | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db.select().from(clubPhotos).where(eq(clubPhotos.id, id));
  return row ?? null;
}

export async function deleteClubPhoto(
  db: Database,
  application: ClubApplication,
  photoId: string,
): Promise<void> {
  if (!editable(application)) return;
  await db
    .delete(clubPhotos)
    .where(and(eq(clubPhotos.id, photoId), eq(clubPhotos.applicationId, application.id)));
}

/** Show a photo on a course page, or take it down. */
export async function setClubPhotoStatus(
  db: Database,
  photoId: string,
  status: "approved" | "declined" | "pending",
  courseId: string | null,
): Promise<void> {
  await db.update(clubPhotos).set({ status, courseId }).where(eq(clubPhotos.id, photoId));
}

/** The approved photo for each course that has one (the earliest uploaded). */
export async function approvedCoursePhotos(db: Database): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: clubPhotos.id, courseId: clubPhotos.courseId })
    .from(clubPhotos)
    .where(eq(clubPhotos.status, "approved"))
    .orderBy(asc(clubPhotos.createdAt));
  const photos = new Map<string, string>();
  for (const r of rows) if (r.courseId && !photos.has(r.courseId)) photos.set(r.courseId, r.id);
  return photos;
}
