import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
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

/**
 * BookOn schema (SPEC section 7, with the changes from docs/m0-review.md).
 * Timestamps are UTC (`timestamptz`). `date` and `time` columns hold Perth
 * calendar dates and wall-clock times as the user sees them.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const platformEnum = pgEnum("platform", ["miclub", "quick18", "chronogolf", "manual"]);
export const checkStatusEnum = pgEnum("check_status", ["ok", "error"]);
export const contactTypeEnum = pgEnum("contact_type", ["email", "push"]);
export const alertStatusEnum = pgEnum("alert_status", [
  "pending",
  "active",
  "paused",
  "deleted",
  "ended",
]);
export const clickSourceEnum = pgEnum("click_source", ["search", "alert", "directory"]);

/** A venue we report to. One club can have several bookable courses. */
export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: createdAt(),
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
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  holes: smallint("holes").notNull(),
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
