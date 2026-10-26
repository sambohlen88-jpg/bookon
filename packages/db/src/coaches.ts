import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  addPerthDays,
  isoWeekday,
  perthDate,
  perthToUtc,
  PLAYER_CHOICE,
  weekDates,
  weeklyDates,
  type CoachProfile,
} from "@bookon/core";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import { GroupSessionClash, createGroupSessions } from "./groups";
import { appSettings, coachContacts, coachPhotos, coaches, courses, groupSessions } from "./schema";

/**
 * Coaches (Milestone 12). A coach signs in with their email and fills in a
 * draft; BookOn approves it before it goes live, and approves every later
 * change the same way.
 */

export type Coach = typeof coaches.$inferSelect;
export type CoachStatus = Coach["status"];

export const CONTACT_METHODS = ["whatsapp", "email", "phone", "website"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

/** The consent a coach gives to show their details, recorded as given. */
export const COACH_CONSENT =
  "I'm happy for BookOn to show my name, photo, rates, teaching hours, places and contact details publicly, so golfers can book lessons with me.";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "coach"
  );
}

async function freeSlug(db: Database, name: string, ownId?: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db.select({ id: coaches.id }).from(coaches).where(eq(coaches.slug, slug));
    if (!taken || taken.id === ownId) return slug;
  }
}

export async function coachForEmail(db: Database, email: string): Promise<Coach | null> {
  const [row] = await db.select().from(coaches).where(eq(coaches.email, email.toLowerCase()));
  return row ?? null;
}

export async function coachById(db: Database, id: string): Promise<Coach | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(coaches).where(eq(coaches.id, id));
  return row ?? null;
}

/** A coach golfers can see, by their page's name. */
export async function liveCoachBySlug(db: Database, slug: string): Promise<LiveCoach | null> {
  return (await listLiveCoaches(db, slug)).find((c) => c.slug === slug) ?? null;
}

export interface LiveCoach {
  id: string;
  slug: string;
  profile: CoachProfile;
  pgaVerified: boolean;
  sample: boolean;
  latitude: number | null;
  longitude: number | null;
  /** The newest approved photo. */
  photoId: string | null;
  /** Golfers can book and pay through BookOn: the coach turned it on and Stripe is set up. */
  takesBookings: boolean;
}

/** Every coach golfers can see, by name. */
export async function listLiveCoaches(db: Database, slug?: string): Promise<LiveCoach[]> {
  const rows = await db
    .select()
    .from(coaches)
    .where(
      and(
        eq(coaches.status, "live"),
        isNotNull(coaches.profile),
        slug ? eq(coaches.slug, slug) : undefined,
      ),
    );
  if (rows.length === 0) return [];
  const photos = await db
    .select({ id: coachPhotos.id, coachId: coachPhotos.coachId })
    .from(coachPhotos)
    .where(
      and(
        inArray(
          coachPhotos.coachId,
          rows.map((r) => r.id),
        ),
        eq(coachPhotos.status, "approved"),
      ),
    )
    .orderBy(desc(coachPhotos.createdAt));
  return rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      profile: r.profile!,
      pgaVerified: r.pgaVerified,
      sample: r.sample,
      latitude: r.latitude,
      longitude: r.longitude,
      photoId: photos.find((p) => p.coachId === r.id)?.id ?? null,
      takesBookings: r.takesBookings && r.paymentsReady,
    }))
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name));
}

/**
 * Save the coach's working copy, starting their listing if it's new. A
 * listing already sent for review stays in review with the latest answers.
 */
export async function saveCoachDraft(
  db: Database,
  email: string,
  draft: CoachProfile,
  now: Date,
  consent?: { by: string },
): Promise<Coach> {
  const existing = await coachForEmail(db, email);
  const consents = consent
    ? { ...(existing?.consents ?? {}), public: { text: COACH_CONSENT, by: consent.by, at: now } }
    : undefined;
  if (!existing) {
    const [row] = await db
      .insert(coaches)
      .values({
        email: email.toLowerCase(),
        slug: await freeSlug(db, draft.name),
        draft,
        ...(consents ? { consents } : {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row!;
  }
  const [row] = await db
    .update(coaches)
    .set({ draft, updatedAt: now, ...(consents ? { consents } : {}) })
    .where(eq(coaches.id, existing.id))
    .returning();
  return row!;
}

/** Send the draft to BookOn. Needs the consent to show details publicly. */
export async function submitCoach(
  db: Database,
  coachId: string,
  now: Date,
): Promise<{ ok: true } | { error: "no-draft" | "no-consent" }> {
  const coach = await coachById(db, coachId);
  if (!coach?.draft) return { error: "no-draft" };
  if (!coach.consents.public) return { error: "no-consent" };
  await db
    .update(coaches)
    .set({ submittedAt: now, updatedAt: now, reviewNote: null })
    .where(eq(coaches.id, coachId));
  return { ok: true };
}

/** Put the draft live. Finds the coach on the map from their first BookOn course, if they have none yet. */
export async function approveCoach(
  db: Database,
  coach: Coach,
  actor: Actor,
  note: string | null,
  now: Date,
): Promise<{ ok: true } | { error: "nothing-to-approve" }> {
  if (!coach.draft) return { error: "nothing-to-approve" };
  let place: { latitude: number | null; longitude: number | null } | undefined;
  const slug = coach.draft.places.find((p) => p.courseSlug)?.courseSlug;
  if (coach.latitude === null && slug) {
    [place] = await db
      .select({ latitude: courses.latitude, longitude: courses.longitude })
      .from(courses)
      .where(eq(courses.slug, slug));
  }
  await db
    .update(coaches)
    .set({
      profile: coach.draft,
      draft: null,
      submittedAt: null,
      status: coach.status === "hidden" ? "hidden" : "live",
      // The page's name follows the coach's name until they're first approved.
      slug: coach.profile ? coach.slug : await freeSlug(db, coach.draft.name, coach.id),
      approvedAt: now,
      reviewNote: note,
      updatedAt: now,
      ...(place?.latitude != null ? { latitude: place.latitude, longitude: place.longitude } : {}),
    })
    .where(eq(coaches.id, coach.id));
  await logChange(
    db,
    actor,
    {
      action: coach.profile ? "Approved coach's changes" : "Approved coach listing",
      details: { coachId: coach.id, name: coach.draft.name, note },
    },
    now,
  );
  return { ok: true };
}

/** Say no to what was sent. The draft stays, so the coach can fix it and send it again. */
export async function declineCoach(
  db: Database,
  coach: Coach,
  actor: Actor,
  note: string | null,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({
      submittedAt: null,
      reviewNote: note,
      status: coach.status === "new" ? "declined" : coach.status,
      updatedAt: now,
    })
    .where(eq(coaches.id, coach.id));
  await logChange(
    db,
    actor,
    {
      action: coach.profile ? "Declined coach's changes" : "Declined coach listing",
      details: { coachId: coach.id, name: (coach.draft ?? coach.profile)?.name, note },
    },
    now,
  );
}

export async function setCoachPgaVerified(
  db: Database,
  coach: Coach,
  verified: boolean,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({ pgaVerified: verified, updatedAt: now })
    .where(eq(coaches.id, coach.id));
  await logChange(
    db,
    actor,
    {
      action: verified ? "Checked coach's PGA membership" : "Unticked coach's PGA membership",
      details: { coachId: coach.id },
    },
    now,
  );
}

/** Take a live coach off the site, or put them back. */
export async function setCoachHidden(
  db: Database,
  coach: Coach,
  hidden: boolean,
  actor: Actor,
  now: Date,
): Promise<void> {
  const status = hidden ? "hidden" : coach.profile ? "live" : "new";
  await db.update(coaches).set({ status, updatedAt: now }).where(eq(coaches.id, coach.id));
  await logChange(
    db,
    actor,
    { action: hidden ? "Hid coach" : "Showed coach again", details: { coachId: coach.id } },
    now,
  );
}

export async function setCoachLocation(
  db: Database,
  coach: Coach,
  location: { latitude: number; longitude: number } | null,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .update(coaches)
    .set({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      updatedAt: now,
    })
    .where(eq(coaches.id, coach.id));
  await logChange(
    db,
    actor,
    { action: "Set coach's location", details: { coachId: coach.id, ...location } },
    now,
  );
}

/** Coaches for the admin list: waiting for review first. */
export async function listCoachesForAdmin(db: Database) {
  const rows = await db.select().from(coaches).orderBy(desc(coaches.updatedAt));
  const pendingPhotos = await db
    .select({ coachId: coachPhotos.coachId, n: count() })
    .from(coachPhotos)
    .where(eq(coachPhotos.status, "pending"))
    .groupBy(coachPhotos.coachId);
  return rows
    .map((r) => ({
      ...r,
      name: (r.draft ?? r.profile)?.name ?? r.email,
      pendingPhotos: pendingPhotos.find((p) => p.coachId === r.id)?.n ?? 0,
    }))
    .sort((a, b) => Number(Boolean(b.submittedAt)) - Number(Boolean(a.submittedAt)));
}

/** How many coaches and coach photos are waiting for an admin. */
export async function coachCounts(db: Database): Promise<{ waiting: number; photos: number }> {
  const [waiting] = await db
    .select({ n: count() })
    .from(coaches)
    .where(isNotNull(coaches.submittedAt));
  const [photos] = await db
    .select({ n: count() })
    .from(coachPhotos)
    .where(eq(coachPhotos.status, "pending"));
  return { waiting: waiting?.n ?? 0, photos: photos?.n ?? 0 };
}

/* ---------- Photos ---------- */

const MAX_COACH_PHOTOS = 5;

export async function addCoachPhoto(
  db: Database,
  coachId: string,
  photo: { data: Buffer; width: number; height: number; contentType: string },
  rightsConfirmedBy: string,
  now: Date,
): Promise<{ id: string } | { error: "limit" }> {
  const [existing] = await db
    .select({ n: count() })
    .from(coachPhotos)
    .where(and(eq(coachPhotos.coachId, coachId), inArray(coachPhotos.status, ["pending"])));
  if ((existing?.n ?? 0) >= MAX_COACH_PHOTOS) return { error: "limit" };
  const [row] = await db
    .insert(coachPhotos)
    .values({ coachId, ...photo, rightsConfirmedBy, createdAt: now })
    .returning({ id: coachPhotos.id });
  return row!;
}

export async function coachPhotoById(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(coachPhotos).where(eq(coachPhotos.id, id));
  return row ?? null;
}

/** A coach's photos, newest first, without the image data. */
export async function listCoachPhotos(db: Database, coachId: string) {
  return db
    .select({
      id: coachPhotos.id,
      status: coachPhotos.status,
      createdAt: coachPhotos.createdAt,
      rightsConfirmedBy: coachPhotos.rightsConfirmedBy,
    })
    .from(coachPhotos)
    .where(eq(coachPhotos.coachId, coachId))
    .orderBy(desc(coachPhotos.createdAt));
}

export async function setCoachPhotoStatus(
  db: Database,
  photoId: string,
  status: "approved" | "declined",
  actor: Actor,
  now: Date,
): Promise<void> {
  const [row] = await db
    .update(coachPhotos)
    .set({ status })
    .where(eq(coachPhotos.id, photoId))
    .returning({ coachId: coachPhotos.coachId });
  if (row)
    await logChange(
      db,
      actor,
      {
        action: status === "approved" ? "Approved coach photo" : "Declined coach photo",
        details: { coachId: row.coachId, photoId },
      },
      now,
    );
}

/* ---------- Contact taps ---------- */

export async function logCoachContact(
  db: Database,
  coachId: string,
  method: ContactMethod,
  sessionId: string | null,
  now: Date,
): Promise<void> {
  await db
    .insert(coachContacts)
    .values({ coachId, method, anonymousSessionId: sessionId, at: now });
}

/** Contact taps since a date, by method, for the coach's portal and admin. */
export async function coachContactCounts(
  db: Database,
  coachId: string,
  since: Date,
): Promise<Record<ContactMethod, number>> {
  const rows = await db
    .select({ method: coachContacts.method, n: count() })
    .from(coachContacts)
    .where(and(eq(coachContacts.coachId, coachId), gte(coachContacts.at, since)))
    .groupBy(coachContacts.method);
  const counts = { whatsapp: 0, email: 0, phone: 0, website: 0 };
  for (const r of rows) if (r.method in counts) counts[r.method as ContactMethod] = r.n;
  return counts;
}

/* ---------- BookOn's social accounts ---------- */

export const SOCIAL_NETWORKS = ["instagram", "facebook", "tiktok"] as const;
export type SocialLinks = Partial<Record<(typeof SOCIAL_NETWORKS)[number], string>>;

export async function socialLinks(db: Database): Promise<SocialLinks> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "social"));
  return (row?.value as SocialLinks | undefined) ?? {};
}

export async function setSocialLinks(
  db: Database,
  links: SocialLinks,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "social", value: links, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: links, updatedAt: now } });
  await logChange(db, actor, { action: "Changed social links", details: links }, now);
}

/* ---------- Sample coaches ---------- */

/**
 * Three made-up coaches, so the Coaches pages have something to show while
 * real ones sign up. Each is marked as a sample on the site, with phone
 * numbers Australia keeps for fiction (ACMA) and example.com email
 * addresses, so nobody real is ever contacted. Local databases only.
 */
export const SAMPLE_COACHES: {
  email: string;
  latitude: number;
  longitude: number;
  profile: CoachProfile;
}[] = [
  {
    email: "mia.hartley@example.com",
    latitude: -31.9,
    longitude: 115.811,
    profile: {
      name: "Mia Hartley",
      headline: "Beginners, short game and women's golf",
      bio: "I love getting new golfers comfortable on the course. Lessons are relaxed and practical: we work on the one or two things that make the biggest difference, then take them out to the course. Clubs are available if you don't have your own yet.",
      specialities: ["beginners", "short-game", "womens"],
      rates: [
        { name: "Private lesson", kind: "private", minutes: 30, priceCents: 6500, people: "1" },
        { name: "Private lesson", kind: "private", minutes: 60, priceCents: 11000, people: "1" },
        {
          name: "9 hole playing lesson",
          kind: "playing",
          // On a course the golfer picks (Milestone 26).
          at: [PLAYER_CHOICE],
          minutes: 120,
          priceCents: 18000,
          people: "1",
        },
        {
          name: "Beginners' clinic (up to 6)",
          kind: "group-clinic",
          minutes: 60,
          priceCents: 4000,
          people: "group",
        },
      ],
      hours: [
        { day: 2, from: "15:00", to: "19:00" },
        { day: 4, from: "15:00", to: "19:00" },
        { day: 6, from: "07:00", to: "12:00" },
      ],
      away: [],
      places: [{ name: "Driving range and practice greens", suburb: "Osborne Park" }],
      travel: { areas: ["north", "west"], note: "Courses within about 20 km of Osborne Park" },
      suburb: "Osborne Park",
      area: "north",
      contact: {
        whatsapp: "+61491570156",
        phone: "+61491570156",
        email: "mia.hartley@example.com",
      },
    },
  },
  {
    email: "daniel.reyes@example.com",
    latitude: -32.016,
    longitude: 115.835,
    profile: {
      name: "Daniel Reyes",
      headline: "All-round coaching, driving and juniors",
      bio: "Fifteen years teaching golfers of every level. Whether you want more distance off the tee, a better plan for getting round the course or a junior program for the kids, we'll set clear goals and track them with video.",
      specialities: ["all-round", "driving", "course-management", "juniors"],
      rates: [
        { name: "Private lesson", kind: "private", minutes: 45, priceCents: 9000, people: "1" },
        { name: "Private lesson", kind: "private", minutes: 60, priceCents: 12000, people: "1" },
        { name: "Lesson for two", kind: "private", minutes: 60, priceCents: 15000, people: "2" },
        { name: "Video swing analysis", kind: "video", minutes: 45, priceCents: 9500, people: "1" },
        {
          name: "Junior squad (8 to 14)",
          kind: "junior",
          minutes: 60,
          priceCents: 3500,
          people: "group",
        },
      ],
      hours: [
        { day: 1, from: "16:00", to: "19:00" },
        { day: 3, from: "16:00", to: "19:00" },
        { day: 7, from: "08:00", to: "13:00" },
      ],
      // Set when added: away for a few days next week, to show how days away look.
      away: [],
      places: [{ name: "Riverside practice range", suburb: "Applecross" }],
      suburb: "Applecross",
      area: "south",
      contact: {
        whatsapp: "+61491570157",
        email: "daniel.reyes@example.com",
      },
    },
  },
  {
    email: "grace.okafor@example.com",
    latitude: -32.056,
    longitude: 115.747,
    profile: {
      name: "Grace Okafor",
      headline: "Putting, seniors and club fitting",
      bio: "Lower scores start on the greens. I help golfers of all ages roll the ball better, and fit clubs that suit how you swing today. Seniors are very welcome, with gentle sessions that look after your back.",
      specialities: ["putting", "seniors", "club-fitting", "short-game"],
      rates: [
        { name: "Putting lesson", kind: "short-game", minutes: 30, priceCents: 6000, people: "1" },
        {
          name: "Private lesson",
          kind: "private",
          minutes: 60,
          priceCents: 10500,
          people: "1",
          weekendCents: 11500,
          publicHolidayCents: 13000,
        },
        { name: "Club fitting", kind: "club-fitting", minutes: 90, priceCents: 15000, people: "1" },
      ],
      hours: [
        { day: 3, from: "09:00", to: "14:00" },
        { day: 5, from: "09:00", to: "14:00" },
        { day: 6, from: "13:00", to: "17:00" },
      ],
      away: [],
      places: [{ name: "Studio and putting green", suburb: "Fremantle" }],
      suburb: "Fremantle",
      area: "west",
      contact: {
        whatsapp: "+61491570158",
        phone: "+61491570158",
        email: "grace.okafor@example.com",
        website: "https://example.com/grace-okafor-golf",
      },
    },
  },
];

/** Add the sample coaches if they aren't there. Only ever call this on a local database. */
export async function seedSampleCoaches(db: Database, now = new Date()): Promise<number> {
  const [existing] = await db.select({ n: count() }).from(coaches).where(eq(coaches.sample, true));
  if ((existing?.n ?? 0) > 0) {
    await samplesTakePracticeBookings(db, now);
    await sampleGroupSessions(db, now);
    return 0;
  }
  const next = weekDates(perthDate(now), "next");
  for (const sample of SAMPLE_COACHES) {
    const profile =
      sample.email === "daniel.reyes@example.com"
        ? { ...sample.profile, away: [{ from: next[0]!, to: next[2]! }] }
        : sample.profile;
    await db
      .insert(coaches)
      .values({
        email: sample.email,
        slug: await freeSlug(db, sample.profile.name),
        status: "live",
        profile,
        sample: true,
        latitude: sample.latitude,
        longitude: sample.longitude,
        consents: { public: { text: COACH_CONSENT, by: "Sample data", at: now } },
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
  await samplesTakePracticeBookings(db, now);
  await sampleGroupSessions(db, now);
  return SAMPLE_COACHES.length;
}

/**
 * Weekly group sessions for two sample coaches (Milestone 19), so booking a
 * spot can be tried locally. Added again once the last ones have passed.
 */
async function sampleGroupSessions(db: Database, now: Date): Promise<void> {
  const samples = await db
    .select({ id: coaches.id, email: coaches.email, profile: coaches.profile })
    .from(coaches)
    .where(eq(coaches.sample, true));
  const today = perthDate(now);
  const next = (weekday: number) =>
    addPerthDays(today, ((weekday - isoWeekday(today) + 7) % 7) + 7);
  const plans = [
    {
      email: "mia.hartley@example.com",
      title: "Beginners' clinic",
      details: "Grip, stance and your first full swings. Clubs to borrow if you need them.",
      dates: weeklyDates(next(6), 4),
      time: "15:00",
      priceCents: 4000,
      spots: 6,
      minSpots: 3,
    },
    {
      email: "daniel.reyes@example.com",
      title: "Junior squad (8 to 14)",
      details: "Games-based practice for juniors. Bring a drink and a hat.",
      dates: weeklyDates(next(7), 4),
      time: "08:00",
      priceCents: 3500,
      spots: 10,
      minSpots: null,
    },
  ];
  for (const plan of plans) {
    const coach = samples.find((c) => c.email === plan.email);
    const place = coach?.profile?.places[0];
    if (!coach || !place) continue;
    const [ahead] = await db
      .select({ n: count() })
      .from(groupSessions)
      .where(and(eq(groupSessions.coachId, coach.id), gte(groupSessions.startTime, now)));
    if ((ahead?.n ?? 0) > 0) continue;
    try {
      await createGroupSessions(
        db,
        {
          coachId: coach.id,
          title: plan.title,
          details: plan.details,
          starts: plan.dates.map((d) => perthToUtc(d, plan.time)),
          minutes: 60,
          place: place.suburb ? `${place.name}, ${place.suburb}` : place.name,
          priceCents: plan.priceCents,
          spots: plan.spots,
          minSpots: plan.minSpots,
        },
        now,
      );
    } catch (error) {
      // Someone booked a lesson then; skip the sample rather than stop.
      if (!(error instanceof GroupSessionClash)) throw error;
    }
  }
}

/**
 * Sample coaches take bookings with made-up payment accounts, so booking a
 * lesson can be tried locally in practice mode (Milestone 15). With real
 * Stripe keys, practice accounts are never offered for booking.
 */
async function samplesTakePracticeBookings(db: Database, now: Date): Promise<void> {
  await db
    .update(coaches)
    .set({
      paymentAccountId: sql`'practice_acct_' || ${coaches.slug}`,
      paymentsReady: true,
      takesBookings: true,
      updatedAt: now,
    })
    .where(and(eq(coaches.sample, true), isNull(coaches.paymentAccountId)));
}

/** Whether the database is a local one, where sample coaches may be added. */
export function isLocalDatabaseUrl(url: string): boolean {
  return url.startsWith("pglite:") || /@(127\.0\.0\.1|localhost):/.test(url);
}
