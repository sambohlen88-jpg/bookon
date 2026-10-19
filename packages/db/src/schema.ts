import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CoachProfile, WeatherHour } from "@bookon/core";
import type { SearchParams } from "./search";
import type { SharedCourse } from "./shares";

/**
 * BookOn schema (SPEC section 7, with the changes from docs/m0-review.md).
 * Timestamps are UTC (`timestamptz`). `date` and `time` columns hold Perth
 * calendar dates and wall-clock times as the user sees them.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const platformEnum = pgEnum("platform", [
  "miclub",
  "quick18",
  "chronogolf",
  "manual",
  "ygb",
]);
/** A golf course (tee times), or a simulator or driving range venue (bays booked by the hour). */
export const venueKindEnum = pgEnum("venue_kind", ["course", "simulator", "range"]);
export const checkStatusEnum = pgEnum("check_status", ["ok", "error"]);
export const contactTypeEnum = pgEnum("contact_type", ["email", "push"]);
export const alertStatusEnum = pgEnum("alert_status", [
  "pending",
  "active",
  "paused",
  "deleted",
  "ended",
]);
export const clickSourceEnum = pgEnum("click_source", ["search", "alert", "directory", "share"]);

/** A venue we report to. One club can have several bookable courses. */
export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: createdAt(),
  /**
   * What the club tells golfers and BookOn: contacts, tee time rules,
   * description, facilities. The same shape as an application's details
   * (ClubApplicationDetails); the club edits it from its login.
   */
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One booking source: a platform calendar we read and link golfers to. */
export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .notNull()
    .references(() => clubs.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  suburb: text("suburb").notNull(),
  /** An AreaId from packages/core/src/areas.ts, for grouping. Admins can change it. */
  area: text("area"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /** 0 for a simulator or range. */
  holes: smallint("holes").notNull(),
  kind: venueKindEnum("kind").notNull().default("course"),
  platform: platformEnum("platform").notNull(),
  platformConfig: jsonb("platform_config").$type<Record<string, unknown>>().notNull().default({}),
  websiteUrl: text("website_url").notNull(),
  bookingUrl: text("booking_url").notNull(),
  /** Feature flag: switches the course off everywhere at once. */
  enabled: boolean("enabled").notNull().default(false),
  /** How far ahead the club releases tee times. We never poll past this. */
  bookingWindowDays: smallint("booking_window_days").notNull().default(7),
  /** Typical adult 18 hole fee, for the club report's estimated value. Only where verified. */
  typicalGreenFeeCents: integer("typical_green_fee_cents"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Current availability. Each successful check of a course and date replaces
 * that day's rows, so this table only ever holds the latest known state.
 */
export const availabilitySnapshots = pgTable(
  "availability_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    playDate: date("play_date").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    holes: smallint("holes").notNull(),
    layout: text("layout"),
    /** The bay at a simulator or range; null for a tee time. */
    bay: text("bay"),
    /** Session lengths in minutes that can start then in that bay. */
    durations: smallint("durations").array(),
    spotsAvailable: smallint("spots_available").notNull(),
    minPlayers: smallint("min_players").notNull().default(1),
    priceCents: integer("price_cents"),
    bookingUrl: text("booking_url"),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("availability_course_date_idx").on(t.courseId, t.playDate),
    index("availability_start_idx").on(t.startTime),
  ],
);

/** When each course and date was last checked. Drives "last checked" labels and stale notices. */
export const availabilityChecks = pgTable(
  "availability_checks",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    playDate: date("play_date").notNull(),
    status: checkStatusEnum("status").notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    teeTimeCount: integer("tee_time_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.playDate] })],
);

/** One worker pass over one course. Feeds the admin source health view. */
export const fetchRuns = pgTable(
  "fetch_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: checkStatusEnum("status"),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    teeTimeCount: integer("tee_time_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("fetch_runs_course_started_idx").on(t.courseId, t.startedAt)],
);

export const searches = pgTable("searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
  anonymousSessionId: text("anonymous_session_id").notNull(),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  timeFrom: time("time_from").notNull(),
  timeTo: time("time_to").notNull(),
  players: smallint("players").notNull(),
  holes: smallint("holes"),
  courseIds: uuid("course_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  resultCount: integer("result_count").notNull(),
});

/** Counted per course per day rather than one row per impression. */
export const dailyImpressions = pgTable(
  "daily_impressions",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    impressions: integer("impressions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.day] })],
);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
  /** The golfer's account. Alerts need one, so the email address is already confirmed. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  contactType: contactTypeEnum("contact_type").notNull(),
  contactValue: text("contact_value").notNull(),
  /** A `SearchParams`: dates, time window, players, holes, courses. Ends after its last date. */
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
  /** `pending` until the email address is confirmed (double opt-in). */
  status: alertStatusEnum("status").notNull().default("pending"),
  manageToken: text("manage_token").notNull().unique(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  /** How the golfer hears about new times. At least one is on. */
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(false),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    holes: smallint("holes").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    channel: contactTypeEnum("channel").notNull(),
    /** The signed /go token in the email. Null for baseline rows. */
    clickToken: text("click_token").unique(),
    /** Already showing when the alert was set up, so never emailed. */
    baseline: boolean("baseline").notNull().default(false),
  },
  // "Notify once per matching slot".
  (t) => [
    uniqueIndex("notifications_once_per_slot").on(t.alertId, t.courseId, t.startTime, t.holes),
  ],
);

export const clickEvents = pgTable(
  "click_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: createdAt(),
    anonymousSessionId: text("anonymous_session_id"),
    /** Set when a signed-in golfer clicks, for their "previous visits". Cleared on request. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    startTime: timestamp("start_time", { withTimezone: true }),
    source: clickSourceEnum("source").notNull(),
    notificationId: uuid("notification_id").references(() => notifications.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("click_events_course_created_idx").on(t.courseId, t.createdAt)],
);

export const clubReports = pgTable("club_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .notNull()
    .references(() => clubs.id),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  createdAt: createdAt(),
  /** The figures as generated, so a sent report can be reproduced exactly. */
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
});

/* Accounts (Milestone 4). Sign-in is by emailed link; there are no passwords. */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stored lower case. */
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
});

/** One-use sign-in links. Only a hash of the token is stored. */
export const signInTokens = pgTable(
  "sign_in_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** Where to go after signing in, e.g. back to a search. A path on this site. */
    next: text("next"),
  },
  (t) => [index("sign_in_tokens_email_created_idx").on(t.email, t.createdAt)],
);

/** A signed-in device. Only a hash of the cookie value is stored. */
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const favourites = pgTable(
  "favourites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

/** Emails "sent" in development, shown at /dev/outbox instead of going out. */
export const outboxEmails = pgTable("outbox_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  html: text("html").notNull(),
});

/** A device (browser or installed app) that agreed to push notifications. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    /** The push service URL for this device. */
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** To tell devices apart on the account page, e.g. "iPhone" or "Chrome on Mac". */
    deviceLabel: text("device_label"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** Small values the app keeps for itself, such as development push keys. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Club onboarding (Milestone 7). */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const clubApplicationStatusEnum = pgEnum("club_application_status", [
  /** Being filled in. The club can come back to it with its private link. */
  "draft",
  /** Sent to BookOn, waiting for review. */
  "submitted",
  "approved",
  "declined",
  "withdrawn",
]);

export const paymentsInterestEnum = pgEnum("payments_interest", ["yes", "maybe", "no"]);

/**
 * A club signing up. The answers that aren't prices or photos live in
 * `details` (typed as ClubApplicationDetails in clubs.ts); once approved,
 * they are copied into clubs and courses.
 */
export const clubApplications = pgTable(
  "club_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    status: clubApplicationStatusEnum("status").notNull().default("draft"),
    /** Hash of the private link the club uses to come back. */
    resumeTokenHash: text("resume_token_hash").notNull().unique(),
    clubName: text("club_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    /** Each approval the club gave: what it said, who gave it and when. */
    consents: jsonb("consents").$type<Record<string, unknown>>().notNull().default({}),
    paymentsInterest: paymentsInterestEnum("payments_interest"),
    /** The club this became, once approved. */
    clubId: uuid("club_id").references(() => clubs.id),
    reviewNotes: text("review_notes"),
  },
  (t) => [index("club_applications_email_idx").on(t.contactEmail, t.createdAt)],
);

export const rateCategoryEnum = pgEnum("rate_category", [
  "green_fee",
  "cart",
  "club_hire",
  "trolley",
  "range",
  "deal",
  "membership",
  "other",
]);
export const rateDaysEnum = pgEnum("rate_days", [
  "any",
  /** Monday to Friday. */
  "weekday",
  "weekend",
  "public_holiday",
  /** The days in `days_of_week`. */
  "custom",
]);
export const ratePlayerEnum = pgEnum("rate_player", [
  "any",
  "adult",
  "senior",
  "concession",
  "junior",
  "student",
  "member_guest",
]);
export const rateUnitEnum = pgEnum("rate_unit", [
  "per_player",
  "per_cart",
  "per_set",
  "per_group",
  "per_item",
]);

/**
 * A club's price list: green fees, carts, club hire, deals and so on, with
 * when each applies. Structured so BookOn can quote and one day take payment.
 */
export const clubRates = pgTable(
  "club_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").references(() => clubApplications.id, {
      onDelete: "cascade",
    }),
    clubId: uuid("club_id").references(() => clubs.id),
    /** Null when it applies at every course the club has. */
    courseName: text("course_name"),
    sort: smallint("sort").notNull().default(0),
    category: rateCategoryEnum("category").notNull(),
    name: text("name").notNull(),
    /** 9 or 18, or null when holes don't matter (club hire, a deal). */
    holes: smallint("holes"),
    days: rateDaysEnum("days").notNull().default("any"),
    /** For `custom` days: 1 = Monday … 7 = Sunday. */
    daysOfWeek: smallint("days_of_week").array(),
    /** Perth times, e.g. twilight from 15:00. */
    timeFrom: time("time_from"),
    timeTo: time("time_to"),
    player: ratePlayerEnum("player").notNull().default("any"),
    priceCents: integer("price_cents").notNull(),
    unit: rateUnitEnum("unit").notNull().default("per_player"),
    gstIncluded: boolean("gst_included").notNull().default(true),
    /** Seasonal prices and deals: Perth dates, inclusive. */
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    notes: text("notes"),
  },
  (t) => [index("club_rates_application_idx").on(t.applicationId, t.sort)],
);

export const photoStatusEnum = pgEnum("photo_status", ["pending", "approved", "declined"]);

/** Photos a club uploaded. Shown on the site only once BookOn approves them. */
export const clubPhotos = pgTable(
  "club_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Uploaded while signing up. */
    applicationId: uuid("application_id").references(() => clubApplications.id, {
      onDelete: "cascade",
    }),
    /** The club it belongs to, once the club is live (or uploaded from the club's login). */
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "cascade" }),
    /** The course it shows, once approved. */
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    status: photoStatusEnum("status").notNull().default("pending"),
    contentType: text("content_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Resized, re-encoded and stripped of location data before saving. */
    data: bytea("data").notNull(),
    caption: text("caption"),
    credit: text("credit"),
    /** The club confirmed it owns the photo or may share it. */
    rightsConfirmedBy: text("rights_confirmed_by").notNull(),
  },
  (t) => [
    index("club_photos_application_idx").on(t.applicationId),
    index("club_photos_course_idx").on(t.courseId, t.status),
  ],
);

/* Admin and club logins (Milestone 8). */

export const clubRoleEnum = pgEnum("club_role", ["owner", "staff"]);

/**
 * Who can sign in to a club's login. Keyed by email, so a person can be
 * added before they've ever signed in: signing in with that email is enough.
 */
export const clubMembers = pgTable(
  "club_members",
  {
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    /** Stored lower case. */
    email: text("email").notNull(),
    role: clubRoleEnum("role").notNull().default("staff"),
    addedBy: text("added_by"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.clubId, t.email] }),
    index("club_members_email_idx").on(t.email),
  ],
);

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "pending",
  "approved",
  "declined",
]);

/** Changes a club asked for that BookOn checks first, such as a new booking page. */
export const changeRequests = pgTable(
  "change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    requestedBy: text("requested_by").notNull(),
    createdAt: createdAt(),
    status: changeRequestStatusEnum("status").notNull().default("pending"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("change_requests_status_idx").on(t.status, t.createdAt)],
);

/** Who changed what and when, by admins and clubs. */
export const changeLog = pgTable(
  "change_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    actorRole: text("actor_role").notNull(),
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("change_log_at_idx").on(t.at), index("change_log_club_idx").on(t.clubId, t.at)],
);

/* Sharing (Milestone 9). A frozen copy of the times a golfer saw, for a link they send mates. */

export const sharedSearches = pgTable(
  "shared_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The unguessable part of the link, /s/<code>. */
    code: text("code").notNull().unique(),
    createdAt: createdAt(),
    /** A week after the last play date. Expired shares are deleted by the worker. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Only to limit how many shares one visitor makes. Never shown. */
    anonymousSessionId: text("anonymous_session_id"),
    /** The search, as /search?<query>, for "See latest times". */
    query: text("query").notNull(),
    params: jsonb("params").$type<SearchParams>().notNull(),
    courses: jsonb("courses").$type<SharedCourse[]>().notNull(),
    totalTeeTimes: integer("total_tee_times").notNull(),
  },
  (t) => [
    index("shared_searches_expires_idx").on(t.expiresAt),
    index("shared_searches_session_idx").on(t.anonymousSessionId, t.createdAt),
  ],
);

/* Weather (Milestone 10). The latest MET Norway forecast for each course, fetched by the worker. */

export const weatherForecasts = pgTable("weather_forecasts", {
  courseId: uuid("course_id")
    .primaryKey()
    .references(() => courses.id, { onDelete: "cascade" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  /** MET Norway's Expires header: don't ask again before this. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** MET Norway's Last-Modified header, sent back as If-Modified-Since. */
  lastModified: text("last_modified"),
  hours: jsonb("hours").$type<WeatherHour[]>().notNull(),
});

/* Coaches (Milestone 12). PGA pros who list their lessons; BookOn approves every listing and change. */

export const coachStatusEnum = pgEnum("coach_status", [
  /** Not approved yet: being filled in, or sent for review. */
  "new",
  "live",
  /** A new listing BookOn said no to. The coach can fix it and send it again. */
  "declined",
  /** Taken off the site by an admin. */
  "hidden",
]);

export const coaches = pgTable(
  "coaches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    /** The email the coach signs in with, lower case. One listing per email. */
    email: text("email").notNull().unique(),
    status: coachStatusEnum("status").notNull().default("new"),
    /** What golfers see. Null until first approved. */
    profile: jsonb("profile").$type<CoachProfile>(),
    /** The coach's working copy; null when it matches what's live. */
    draft: jsonb("draft").$type<CoachProfile>(),
    /** When the draft was sent for review; null while it's still being worked on. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** BookOn checked the PGA membership. */
    pgaVerified: boolean("pga_verified").notNull().default(false),
    /** Made up, to show how the pages look. Only ever added to local databases. */
    sample: boolean("sample").notNull().default(false),
    /** For Near me. From the coach's course, or set by an admin. */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /** The coach agreed to show their contact details publicly. */
    consents: jsonb("consents").$type<Record<string, unknown>>().notNull().default({}),
    /** BookOn's note to the coach on the last decision. */
    reviewNote: text("review_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coaches_status_idx").on(t.status)],
);

/** A coach's photo. Shown only once BookOn approves it; the newest approved one is used. */
export const coachPhotos = pgTable(
  "coach_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coaches.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    status: photoStatusEnum("status").notNull().default("pending"),
    contentType: text("content_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    /** The coach confirmed it's their photo to share. */
    rightsConfirmedBy: text("rights_confirmed_by").notNull(),
  },
  (t) => [index("coach_photos_coach_idx").on(t.coachId, t.status)],
);

/** Each tap on a coach's WhatsApp, email, call or website button, so coaches can see what BookOn sends them. */
export const coachContacts = pgTable(
  "coach_contacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coaches.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    method: text("method").notNull(),
    anonymousSessionId: text("anonymous_session_id"),
  },
  (t) => [index("coach_contacts_coach_idx").on(t.coachId, t.at)],
);

/*
 * Unbooked tee times (Milestone 13). A tee time is recorded here when it was
 * still free in a check within the hour before it started. Golf courses
 * only; admins see the totals in Reports.
 */
export const unbookedSlots = pgTable(
  "unbooked_slots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Perth date. */
    playDate: date("play_date").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    holes: smallint("holes").notNull(),
    layout: text("layout"),
    /** Player spots still empty. */
    spotsLeft: smallint("spots_left").notNull(),
    /** Per player, when the club shows a price. */
    priceCents: integer("price_cents"),
    /** The last check that saw it free. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("unbooked_slots_once").on(
      t.courseId,
      t.startTime,
      t.holes,
      sql`coalesce(${t.layout}, '')`,
    ),
    index("unbooked_slots_date_idx").on(t.playDate),
  ],
);
