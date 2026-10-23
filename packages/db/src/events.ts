import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import {
  CHECKOUT_MINUTES,
  DEFAULT_BOOKING_FEE_CENTS,
  EVENT_REMINDER_HOURS,
  GROUP_SIZE,
  buildStartSheet,
  entryFeesCents,
  maxGroups,
  shuffled,
} from "@bookon/core";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import {
  appSettings,
  clubs,
  courses,
  eventEntries,
  eventWaitlist,
  events,
  type EventPlayer,
} from "./schema";

/**
 * Club events (Milestone 21). Like lessons, these functions only move an
 * entry or event from the state they expect; @bookon/payments moves the
 * money first and then calls them.
 */

export type ClubEvent = typeof events.$inferSelect;
export type EventEntry = typeof eventEntries.$inferSelect;
export type EventEntryStatus = EventEntry["status"];
export type WaitlistEntry = typeof eventWaitlist.$inferSelect;
export type { EventPlayer };

/* Club payments */

/** What a club owner agrees to before taking event entries through BookOn. Bump the version when it changes. */
export const EVENT_TERMS_VERSION = 1;
export const EVENT_TERMS =
  "Our club will take event entries and payments through BookOn. Golfers pay our entry fees plus BookOn's booking fee; Stripe pays our fees to the club's bank account. A golfer who withdraws before entries close gets a full refund. If we cancel an event, everyone who entered is refunded in full. We decide any refund after entries close, and we run the event; BookOn isn't responsible for it.";

export async function setClubPaymentAccount(
  db: Database,
  clubId: string,
  accountId: string,
  now: Date,
): Promise<void> {
  await db
    .update(clubs)
    .set({ paymentAccountId: accountId, paymentsReady: false, updatedAt: now })
    .where(eq(clubs.id, clubId));
}

/** Record what Stripe says about a club's account. */
export async function setClubPaymentsReady(
  db: Database,
  accountId: string,
  ready: boolean,
  now: Date,
): Promise<void> {
  await db
    .update(clubs)
    .set({ paymentsReady: ready, updatedAt: now })
    .where(eq(clubs.paymentAccountId, accountId));
}

export async function acceptEventTerms(
  db: Database,
  clubId: string,
  by: string,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .update(clubs)
    .set({
      eventTerms: {
        by,
        email: actor.email,
        at: now.toISOString(),
        version: EVENT_TERMS_VERSION,
        text: EVENT_TERMS,
      },
      updatedAt: now,
    })
    .where(eq(clubs.id, clubId));
  await logChange(db, actor, { action: "Agreed to the event payment terms", clubId }, now);
}

export function acceptedEventTerms(club: { eventTerms: Record<string, unknown> | null }): boolean {
  return club.eventTerms?.version === EVENT_TERMS_VERSION;
}

export interface EventPaymentSettings {
  /** Clubs can take entries and payments. */
  enabled: boolean;
  /** BookOn's booking fee, once per entry. */
  feeCents: number;
}

export async function eventPaymentSettings(db: Database): Promise<EventPaymentSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "event_payments"));
  const value = (row?.value ?? {}) as Partial<EventPaymentSettings>;
  return {
    enabled: value.enabled ?? true,
    feeCents: value.feeCents ?? DEFAULT_BOOKING_FEE_CENTS,
  };
}

export async function setEventPaymentSettings(
  db: Database,
  settings: EventPaymentSettings,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "event_payments", value: settings, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: settings, updatedAt: now } });
  await logChange(db, actor, { action: "Changed event payments", details: { ...settings } }, now);
}

/* Events */

export interface EventInput {
  courseId: string;
  title: string;
  description: string | null;
  date: string;
  holes: number;
  startType: "tees" | "shotgun";
  firstStart: Date;
  intervalMinutes: number;
  twoTees: boolean;
  teamSize: number;
  feeCents: number;
  memberFeeCents: number | null;
  maxPlayers: number;
  entriesClose: Date;
  open: boolean;
}

export async function createEvent(
  db: Database,
  clubId: string,
  input: EventInput,
  actor: Actor,
  now: Date,
): Promise<ClubEvent> {
  const [row] = await db
    .insert(events)
    .values({ ...input, clubId, createdBy: actor.email, createdAt: now, updatedAt: now })
    .returning();
  await logChange(
    db,
    actor,
    {
      action: "Put on an event",
      clubId,
      courseId: input.courseId,
      details: { title: input.title },
    },
    now,
  );
  return row!;
}

/** Fields a club can still change once golfers have entered. */
export const EDITABLE_AFTER_ENTRIES = [
  "title",
  "description",
  "entriesClose",
  "maxPlayers",
  "open",
] as const;

export class EventEditProblem extends Error {}

/**
 * Change an event. Once anyone has entered, only the title, description,
 * closing time, field size and listing can change, and the field can't
 * shrink below the places already taken.
 */
export async function updateEvent(
  db: Database,
  event: ClubEvent,
  input: EventInput,
  actor: Actor,
  now: Date,
): Promise<ClubEvent> {
  if (event.status !== "open") throw new EventEditProblem("This event has been cancelled.");
  const taken = (await placesTaken(db, [event.id], now)).get(event.id) ?? 0;
  const entered = (await entriesForEvent(db, event.id)).length > 0 || taken > 0;
  if (input.maxPlayers < taken)
    throw new EventEditProblem(`${taken} places are already taken, so the field can't be smaller.`);
  const set = entered
    ? Object.fromEntries(EDITABLE_AFTER_ENTRIES.map((k) => [k, input[k]]))
    : { ...input };
  const [row] = await db
    .update(events)
    .set({ ...set, updatedAt: now })
    .where(eq(events.id, event.id))
    .returning();
  await logChange(
    db,
    actor,
    { action: "Changed an event", clubId: event.clubId, details: { title: input.title } },
    now,
  );
  return row!;
}

export async function eventById(db: Database, id: string): Promise<ClubEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row ?? null;
}

/** Players entered, or held at checkout, on each event. */
export async function placesTaken(
  db: Database,
  eventIds: string[],
  now: Date,
): Promise<Map<string, number>> {
  const taken = new Map<string, number>(eventIds.map((id) => [id, 0]));
  if (eventIds.length === 0) return taken;
  const rows = await db
    .select({
      eventId: eventEntries.eventId,
      players: sql<number>`sum(${eventEntries.playerCount})::int`,
    })
    .from(eventEntries)
    .where(
      and(
        inArray(eventEntries.eventId, eventIds),
        or(
          eq(eventEntries.status, "paid"),
          and(eq(eventEntries.status, "checkout"), gt(eventEntries.checkoutExpiresAt, now)),
        ),
      ),
    )
    .groupBy(eventEntries.eventId);
  for (const r of rows) taken.set(r.eventId, Number(r.players));
  return taken;
}

/** Players on paid entries, leaving out checkouts. */
export async function paidPlaces(db: Database, eventId: string): Promise<number> {
  const [row] = await db
    .select({ players: sql<number>`coalesce(sum(${eventEntries.playerCount}), 0)::int` })
    .from(eventEntries)
    .where(and(eq(eventEntries.eventId, eventId), eq(eventEntries.status, "paid")));
  return Number(row?.players ?? 0);
}

export interface ListedEvent extends ClubEvent {
  taken: number;
  left: number;
  clubName: string;
  courseName: string;
  courseSlug: string;
  area: string | null;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
}

async function listed(db: Database, where: ReturnType<typeof and>, now: Date) {
  const rows = await db
    .select({
      event: events,
      clubName: clubs.name,
      courseName: courses.name,
      courseSlug: courses.slug,
      area: courses.area,
      suburb: courses.suburb,
      latitude: courses.latitude,
      longitude: courses.longitude,
    })
    .from(events)
    .innerJoin(clubs, eq(clubs.id, events.clubId))
    .innerJoin(courses, eq(courses.id, events.courseId))
    .where(where)
    .orderBy(asc(events.firstStart));
  const taken = await placesTaken(
    db,
    rows.map((r) => r.event.id),
    now,
  );
  return rows.map(({ event, ...rest }): ListedEvent => {
    const n = taken.get(event.id) ?? 0;
    return { ...event, ...rest, taken: n, left: Math.max(0, event.maxPlayers - n) };
  });
}

/** Open events still to come, for golfers. Only clubs taking payments, and only listed events. */
export async function upcomingOpenEvents(
  db: Database,
  now: Date,
  options: { clubIds?: string[]; courseId?: string } = {},
): Promise<ListedEvent[]> {
  if (options.clubIds && options.clubIds.length === 0) return [];
  return listed(
    db,
    and(
      eq(events.status, "open"),
      eq(events.open, true),
      gt(events.firstStart, now),
      eq(clubs.paymentsReady, true),
      options.clubIds ? inArray(events.clubId, options.clubIds) : undefined,
      options.courseId ? eq(events.courseId, options.courseId) : undefined,
    ),
    now,
  );
}

export async function listedEvent(
  db: Database,
  id: string,
  now: Date,
): Promise<ListedEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await listed(db, and(eq(events.id, id)), now))[0] ?? null;
}

/** A club's events: those still to come first, then the last few months. */
export async function eventsForClub(
  db: Database,
  clubId: string,
  now: Date,
): Promise<ListedEvent[]> {
  const since = new Date(now.getTime() - 120 * 86_400_000);
  return listed(db, and(eq(events.clubId, clubId), gte(events.firstStart, since)), now);
}

/* Entries */

export class EventClosed extends Error {
  constructor(message = "Entries for this event are closed") {
    super(message);
  }
}

export class EventFull extends Error {
  constructor(readonly left: number) {
    super(left > 0 ? `Only ${left} places left` : "Full");
  }
}

export interface NewEntry {
  eventId: string;
  players: EventPlayer[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note?: string;
  userId?: string | null;
  bookingFeeCents: number;
  provider: string;
}

/**
 * Hold places at checkout for CHECKOUT_MINUTES. Throws EventClosed if the
 * event is cancelled, past or closed, and EventFull if there isn't room.
 */
export async function createEventEntry(
  db: Database,
  input: NewEntry,
  now: Date,
): Promise<EventEntry> {
  return db.transaction(async (tx) => {
    // Lock the event so two teams can't take the last places at once.
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, input.eventId))
      .for("update");
    if (!event || event.status !== "open") throw new EventClosed("This event has been cancelled");
    if (event.entriesClose <= now) throw new EventClosed();
    if (input.players.length !== event.teamSize)
      throw new Error(`This event takes teams of ${event.teamSize}`);
    const taken =
      (await placesTaken(tx as unknown as Database, [event.id], now)).get(event.id) ?? 0;
    const left = event.maxPlayers - taken;
    if (input.players.length > left) throw new EventFull(Math.max(0, left));
    const [row] = await tx
      .insert(eventEntries)
      .values({
        eventId: event.id,
        players: input.players,
        playerCount: input.players.length,
        contactName: input.contactName,
        contactEmail: input.contactEmail.toLowerCase(),
        contactPhone: input.contactPhone,
        note: input.note || null,
        userId: input.userId ?? null,
        feesCents: entryFeesCents(event, input.players),
        bookingFeeCents: input.bookingFeeCents,
        manageToken: randomBytes(24).toString("base64url"),
        provider: input.provider,
        checkoutExpiresAt: new Date(now.getTime() + CHECKOUT_MINUTES * 60_000),
        createdAt: now,
      })
      .returning();
    return row!;
  });
}

export async function setEntryCheckout(
  db: Database,
  id: string,
  checkoutId: string,
): Promise<void> {
  await db.update(eventEntries).set({ checkoutId }).where(eq(eventEntries.id, id));
}

export async function entryById(db: Database, id: string): Promise<EventEntry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(eventEntries).where(eq(eventEntries.id, id));
  return row ?? null;
}

export async function entryByToken(db: Database, token: string): Promise<EventEntry | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(eventEntries).where(eq(eventEntries.manageToken, token));
  return row ?? null;
}

export async function entryByCheckout(
  db: Database,
  checkoutId: string,
): Promise<EventEntry | null> {
  const [row] = await db.select().from(eventEntries).where(eq(eventEntries.checkoutId, checkoutId));
  return row ?? null;
}

async function moveEntry(
  db: Database,
  id: string,
  from: EventEntryStatus[],
  set: Partial<typeof eventEntries.$inferInsert>,
): Promise<EventEntry | null> {
  const [row] = await db
    .update(eventEntries)
    .set(set)
    .where(and(eq(eventEntries.id, id), inArray(eventEntries.status, from)))
    .returning();
  return row ?? null;
}

export function markEntryPaid(db: Database, id: string, paymentId: string, now: Date) {
  return moveEntry(db, id, ["checkout"], { status: "paid", paymentId, paidAt: now });
}

export function markEntryAbandoned(db: Database, id: string) {
  return moveEntry(db, id, ["checkout"], { status: "abandoned" });
}

/** Take a paid entry off the event: withdrawn by the golfer or club, or the event was cancelled. */
export function endEntry(
  db: Database,
  id: string,
  input: { by: "golfer" | "club" | "event"; refundCents: number },
  now: Date,
) {
  return moveEntry(db, id, ["paid"], {
    status: input.by === "event" ? "cancelled" : "withdrawn",
    cancelledAt: now,
    cancelledBy: input.by,
    refundCents: input.refundCents,
    startGroup: null,
  });
}

export function entryTotalCents(entry: Pick<EventEntry, "feesCents" | "bookingFeeCents">): number {
  return entry.feesCents + entry.bookingFeeCents;
}

/** Paid entries, in the order they came in. */
export function entriesForEvent(db: Database, eventId: string): Promise<EventEntry[]> {
  return db
    .select()
    .from(eventEntries)
    .where(and(eq(eventEntries.eventId, eventId), eq(eventEntries.status, "paid")))
    .orderBy(asc(eventEntries.paidAt), asc(eventEntries.createdAt));
}

/** Withdrawn and cancelled entries, for the club's list. */
export function endedEntriesForEvent(db: Database, eventId: string): Promise<EventEntry[]> {
  return db
    .select()
    .from(eventEntries)
    .where(
      and(
        eq(eventEntries.eventId, eventId),
        inArray(eventEntries.status, ["withdrawn", "cancelled"]),
      ),
    )
    .orderBy(desc(eventEntries.cancelledAt));
}

/** A golfer's entries, by their email or their account, with each event. */
export async function entriesForGolfer(db: Database, email: string, userId?: string) {
  return db
    .select({ entry: eventEntries, event: events, clubName: clubs.name })
    .from(eventEntries)
    .innerJoin(events, eq(events.id, eventEntries.eventId))
    .innerJoin(clubs, eq(clubs.id, events.clubId))
    .where(
      and(
        or(
          eq(eventEntries.contactEmail, email.toLowerCase()),
          userId ? eq(eventEntries.userId, userId) : undefined,
        ),
        inArray(eventEntries.status, ["paid", "withdrawn", "cancelled"]),
      ),
    )
    .orderBy(desc(events.firstStart));
}

/* Cancelling an event */

export async function cancelEvent(
  db: Database,
  event: ClubEvent,
  note: string | null,
  actor: Actor,
  now: Date,
): Promise<ClubEvent | null> {
  const [row] = await db
    .update(events)
    .set({ status: "cancelled", cancelledAt: now, cancelNote: note, updatedAt: now })
    .where(and(eq(events.id, event.id), eq(events.status, "open")))
    .returning();
  if (row)
    await logChange(
      db,
      actor,
      { action: "Cancelled an event", clubId: event.clubId, details: { title: event.title } },
      now,
    );
  return row ?? null;
}

/** Paid entries on cancelled events: each still to be refunded. */
export function entriesToRefund(db: Database, eventId?: string) {
  return db
    .select({ entry: eventEntries, event: events })
    .from(eventEntries)
    .innerJoin(events, eq(events.id, eventEntries.eventId))
    .where(
      and(
        eq(eventEntries.status, "paid"),
        eq(events.status, "cancelled"),
        eventId ? eq(events.id, eventId) : undefined,
      ),
    );
}

export function staleEntryCheckouts(db: Database, now: Date): Promise<EventEntry[]> {
  return db
    .select()
    .from(eventEntries)
    .where(and(eq(eventEntries.status, "checkout"), lte(eventEntries.checkoutExpiresAt, now)));
}

/* Start sheet */

export class StartSheetProblem extends Error {}

/** Save a start sheet: each entry's group. Unpublishes nothing; moves are emailed once published. */
export async function saveStartGroups(
  db: Database,
  eventId: string,
  groups: Map<string, number>,
): Promise<void> {
  for (const [entryId, group] of groups)
    await db
      .update(eventEntries)
      .set({ startGroup: group })
      .where(and(eq(eventEntries.id, entryId), eq(eventEntries.eventId, eventId)));
}

/**
 * Make (or remake) the start sheet: every paid entry in groups of up to four,
 * teams kept together, in entry order or shuffled. Returns the number of groups.
 */
export async function buildStartSheetFor(
  db: Database,
  event: Pick<ClubEvent, "id" | "startType" | "holes">,
  shuffle: boolean,
): Promise<number> {
  const entries = await entriesForEvent(db, event.id);
  const order = shuffle ? shuffled(entries) : entries;
  const groups = buildStartSheet(order.map((e) => ({ id: e.id, players: e.playerCount })));
  const count = Math.max(0, ...groups.values());
  if (count > maxGroups(event))
    throw new StartSheetProblem(
      `That's ${count} groups, more than a shotgun on ${event.holes} holes can take (${maxGroups(event)}).`,
    );
  await saveStartGroups(db, event.id, groups);
  return count;
}

/** Move one entry to another group, if there's room for the whole team. */
export async function moveEntryToGroup(
  db: Database,
  event: ClubEvent,
  entryId: string,
  group: number,
): Promise<EventEntry> {
  if (!Number.isInteger(group) || group < 1 || group > maxGroups(event))
    throw new StartSheetProblem("Pick a group on the start sheet.");
  const entries = await entriesForEvent(db, event.id);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) throw new StartSheetProblem("That entry wasn't found.");
  const already = entries
    .filter((e) => e.startGroup === group && e.id !== entryId)
    .reduce((n, e) => n + e.playerCount, 0);
  if (already + entry.playerCount > GROUP_SIZE)
    throw new StartSheetProblem(
      `Group ${group} doesn't have room for ${entry.contactName}'s team.`,
    );
  const [row] = await db
    .update(eventEntries)
    .set({ startGroup: group })
    .where(eq(eventEntries.id, entryId))
    .returning();
  return row!;
}

export async function publishStartSheet(
  db: Database,
  event: ClubEvent,
  actor: Actor,
  now: Date,
): Promise<ClubEvent> {
  const unplaced = (await entriesForEvent(db, event.id)).filter((e) => e.startGroup === null);
  if (unplaced.length > 0)
    throw new StartSheetProblem(
      `${unplaced.length} ${unplaced.length === 1 ? "entry isn't" : "entries aren't"} in a group yet.`,
    );
  const [row] = await db
    .update(events)
    .set({ startSheetPublishedAt: now, updatedAt: now })
    .where(eq(events.id, event.id))
    .returning();
  await logChange(
    db,
    actor,
    { action: "Published a start sheet", clubId: event.clubId, details: { title: event.title } },
    now,
  );
  return row!;
}

export async function setEventResults(
  db: Database,
  event: ClubEvent,
  results: string | null,
  now: Date,
): Promise<void> {
  await db
    .update(events)
    .set({ results, resultsAt: results ? now : null, updatedAt: now })
    .where(eq(events.id, event.id));
}

/* Waiting list */

export async function joinWaitlist(
  db: Database,
  input: { eventId: string; name: string; email: string; players: number },
  now: Date,
): Promise<void> {
  await db
    .insert(eventWaitlist)
    .values({ ...input, email: input.email.toLowerCase(), createdAt: now })
    .onConflictDoUpdate({
      target: [eventWaitlist.eventId, eventWaitlist.email],
      set: { name: input.name, players: input.players, notifiedAt: null },
    });
}

export function waitlistFor(db: Database, eventId: string): Promise<WaitlistEntry[]> {
  return db
    .select()
    .from(eventWaitlist)
    .where(eq(eventWaitlist.eventId, eventId))
    .orderBy(asc(eventWaitlist.createdAt));
}

export async function leaveWaitlist(db: Database, eventId: string, email: string): Promise<void> {
  await db
    .delete(eventWaitlist)
    .where(and(eq(eventWaitlist.eventId, eventId), eq(eventWaitlist.email, email.toLowerCase())));
}

export async function markWaitlistNotified(db: Database, ids: string[], now: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.update(eventWaitlist).set({ notifiedAt: now }).where(inArray(eventWaitlist.id, ids));
}

/* Worker */

/** Events whose entries have closed and the club hasn't been told. */
export function eventsJustClosed(db: Database, now: Date): Promise<ClubEvent[]> {
  return db
    .select()
    .from(events)
    .where(
      and(eq(events.status, "open"), lte(events.entriesClose, now), isNull(events.closedNoticeAt)),
    );
}

export async function markClosedNotice(db: Database, id: string, now: Date): Promise<void> {
  await db.update(events).set({ closedNoticeAt: now }).where(eq(events.id, id));
}

/** Events starting within EVENT_REMINDER_HOURS whose entrants haven't had their reminder. */
export function eventsDueReminder(db: Database, now: Date): Promise<ClubEvent[]> {
  const soon = new Date(now.getTime() + EVENT_REMINDER_HOURS * 3_600_000);
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.status, "open"),
        isNull(events.reminderSentAt),
        lte(events.firstStart, soon),
        gt(events.firstStart, now),
      ),
    );
}

export async function markReminderSent(db: Database, id: string, now: Date): Promise<void> {
  await db.update(events).set({ reminderSentAt: now }).where(eq(events.id, id));
}

/* Admin */

export async function listEventsForAdmin(db: Database, now: Date) {
  const since = new Date(now.getTime() - 180 * 86_400_000);
  return listed(db, and(gte(events.firstStart, since)), now);
}

export interface EventTotals {
  entries: number;
  players: number;
  /** Paid to clubs, less refunds. */
  clubCents: number;
  /** Booking fees kept, less refunds. */
  feeCents: number;
}

/** Entries paid from `from` up to `to`, for Reports. */
export async function eventTotals(db: Database, from: Date, to: Date): Promise<EventTotals> {
  const rows = await db
    .select()
    .from(eventEntries)
    .where(
      and(
        isNotNull(eventEntries.paidAt),
        sql`${eventEntries.paidAt} >= ${from.toISOString()}::timestamptz`,
        sql`${eventEntries.paidAt} < ${to.toISOString()}::timestamptz`,
      ),
    );
  const kept = rows.filter((e) => e.refundCents === 0);
  return {
    entries: rows.length,
    players: rows.reduce((n, e) => n + e.playerCount, 0),
    clubCents: kept.reduce((n, e) => n + e.feesCents, 0),
    feeCents: kept.reduce((n, e) => n + e.bookingFeeCents, 0),
  };
}
