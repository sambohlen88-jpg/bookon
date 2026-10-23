import { TEAM_NAME, eventFreeToCancel, type TeamSize } from "@bookon/core";
import {
  EventClosed,
  EventFull,
  acceptedEventTerms,
  cancelEvent,
  clubById,
  createEventEntry,
  endEntry,
  entriesForEvent,
  entriesToRefund,
  entryTotalCents,
  eventById,
  eventPaymentSettings,
  eventsDueReminder,
  eventsJustClosed,
  leaveWaitlist,
  listClubMembers,
  listedEvent,
  markClosedNotice,
  markEntryAbandoned,
  markEntryPaid,
  markReminderSent,
  markWaitlistNotified,
  moveEntryToGroup,
  paidPlaces,
  placesTaken,
  publishStartSheet,
  setClubPaymentAccount,
  setClubPaymentsReady,
  setEntryCheckout,
  staleEntryCheckouts,
  waitlistFor,
  type Actor,
  type Club,
  type ClubEvent,
  type EventEntry,
  type EventPlayer,
} from "@bookon/db";
import {
  eventCancelledEmail,
  eventClosedClubEmail,
  eventEnteredEmail,
  eventEntryClubEmail,
  eventPlaceFreeEmail,
  eventReminderEmail,
  eventStartEmail,
  eventWithdrawnClubEmail,
  eventWithdrawnEmail,
  lessonWhen,
  type EmailMessage,
} from "@bookon/email";
import { BookingProblem, type LessonContext } from "./bookings";
import { usableAccount } from "./provider";

/**
 * Club events (Milestone 21): golfers enter and pay straight away; entry
 * fees go to the club's own Stripe account. Money moves first, then the
 * entry, and each step only moves an entry from the state it expects.
 */

export function entryManageLink(site: string, entry: Pick<EventEntry, "manageToken">): string {
  return `${site}/entries/${entry.manageToken}`;
}

export function eventLink(site: string, event: Pick<ClubEvent, "id">): string {
  return `${site}/competitions/${event.id}`;
}

function portalLink(site: string, event: Pick<ClubEvent, "id" | "clubId">): string {
  return `${site}/club/${event.clubId}/events/${event.id}`;
}

async function send(ctx: LessonContext, message: EmailMessage): Promise<void> {
  try {
    await ctx.mailer.send(message);
  } catch (error) {
    console.error(`[events] could not email ${message.to}: ${message.subject}`, error);
  }
}

/** Who at the club hears about entries: its contact email, or else its owners. */
async function clubInbox(ctx: LessonContext, club: Club): Promise<string[]> {
  if (club.contactEmail) return [club.contactEmail];
  return (await listClubMembers(ctx.db, club.id))
    .filter((m) => m.role === "owner")
    .map((m) => m.email);
}

async function eventContext(ctx: LessonContext, eventId: string) {
  const event = await eventById(ctx.db, eventId);
  if (!event) throw new Error(`Event ${eventId} is missing`);
  const club = await clubById(ctx.db, event.clubId);
  if (!club) throw new Error(`Club ${event.clubId} is missing`);
  const listed = await listedEvent(ctx.db, event.id, ctx.now);
  return {
    event,
    club,
    where: { clubName: club.name, courseName: listed?.courseName ?? club.name },
  };
}

/* Club payments */

/** Whether golfers can enter this club's events and pay right now. */
export async function clubTakesEntries(ctx: Pick<LessonContext, "db" | "payments">, club: Club) {
  const settings = await eventPaymentSettings(ctx.db);
  return (
    settings.enabled &&
    club.paymentsReady &&
    acceptedEventTerms(club) &&
    usableAccount(ctx.payments, club.paymentAccountId)
  );
}

/** Where to send a club owner to set up (or finish setting up) the club's payment account. */
export async function clubPaymentsSetupLink(
  ctx: LessonContext,
  club: Club,
  email: string,
  urls: { returnUrl: string; refreshUrl: string },
): Promise<string> {
  let accountId = club.paymentAccountId;
  if (!usableAccount(ctx.payments, accountId)) {
    accountId = await ctx.payments.createAccount({ email, name: club.name, kind: "club" });
    await setClubPaymentAccount(ctx.db, club.id, accountId, ctx.now);
  }
  return ctx.payments.onboardingLink(accountId!, urls);
}

export async function refreshClubPayments(ctx: LessonContext, club: Club): Promise<boolean> {
  if (!usableAccount(ctx.payments, club.paymentAccountId)) return false;
  const ready = await ctx.payments.accountReady(club.paymentAccountId!);
  if (ready !== club.paymentsReady)
    await setClubPaymentsReady(ctx.db, club.paymentAccountId!, ready, ctx.now);
  return ready;
}

/* Entering */

export interface EntryRequest {
  event: ClubEvent;
  players: EventPlayer[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note?: string;
  userId?: string | null;
}

/** Check the entry, hold the places, and open the checkout page. Returns where to send the golfer. */
export async function startEntryCheckout(ctx: LessonContext, request: EntryRequest) {
  const { event } = request;
  const club = await clubById(ctx.db, event.clubId);
  if (!club || !(await clubTakesEntries(ctx, club)))
    throw new BookingProblem("This club isn't taking entries through BookOn right now.");
  const players = request.players.map((p) => ({
    name: p.name.trim().slice(0, 80),
    ...(p.memberNumber?.trim() ? { memberNumber: p.memberNumber.trim().slice(0, 30) } : {}),
  }));
  if (players.length !== event.teamSize || players.some((p) => !p.name))
    throw new BookingProblem(
      event.teamSize === 1
        ? "Add the player's name."
        : `Add all ${event.teamSize} players' names (${TEAM_NAME[event.teamSize as TeamSize].toLowerCase()}).`,
    );
  if (!event.open && players.some((p) => !p.memberNumber))
    throw new BookingProblem("This event is for members only: add each player's member number.");
  const { feeCents } = await eventPaymentSettings(ctx.db);
  let entry: EventEntry;
  try {
    entry = await createEventEntry(
      ctx.db,
      {
        eventId: event.id,
        players,
        contactName: request.contactName,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone,
        note: request.note,
        userId: request.userId,
        bookingFeeCents: feeCents,
        provider: ctx.payments.kind,
      },
      ctx.now,
    );
  } catch (error) {
    if (error instanceof EventFull)
      throw new BookingProblem(
        error.left > 0
          ? `Sorry, only ${error.left} ${error.left === 1 ? "place is" : "places are"} left now.`
          : "Sorry, this event has just filled up. You can join the waiting list.",
      );
    if (error instanceof EventClosed)
      throw new BookingProblem(`Sorry, ${error.message.toLowerCase()}.`);
    throw error;
  }
  try {
    const checkout = await ctx.payments.createCheckout({
      bookingId: entry.id,
      description: `${event.title} at ${club.name}, ${lessonWhen(event.firstStart)} (${entry.playerCount} ${entry.playerCount === 1 ? "player" : "players"})`,
      lessonCents: entry.feesCents,
      feeCents: entry.bookingFeeCents,
      accountId: club.paymentAccountId!,
      email: entry.contactEmail,
      successUrl: `${entryManageLink(ctx.site, entry)}?paid=1`,
      cancelUrl: `${eventLink(ctx.site, event)}?cancelled=${entry.id}`,
      expiresAt: entry.checkoutExpiresAt,
      capture: "automatic",
    });
    await setEntryCheckout(ctx.db, entry.id, checkout.id);
    return checkout.url;
  } catch (error) {
    await markEntryAbandoned(ctx.db, entry.id);
    throw error;
  }
}

/** The golfer has paid. Safe to call more than once. Refunds at once if the event was cancelled meanwhile. */
export async function entryPaid(
  ctx: LessonContext,
  entryId: string,
  paymentId: string,
): Promise<EventEntry | null> {
  const entry = await markEntryPaid(ctx.db, entryId, paymentId, ctx.now);
  if (!entry) return null;
  const { event, club, where } = await eventContext(ctx, entry.eventId);
  if (event.status === "cancelled") {
    await refundForCancelledEvent(ctx, entry, event, where);
    return entry;
  }
  await leaveWaitlist(ctx.db, event.id, entry.contactEmail);
  await send(
    ctx,
    eventEnteredEmail({ event, entry, where, manageLink: entryManageLink(ctx.site, entry) }),
  );
  const entered = await paidPlaces(ctx.db, event.id);
  for (const to of await clubInbox(ctx, club))
    await send(
      ctx,
      eventEntryClubEmail({
        to,
        event,
        entry,
        where,
        entered,
        maxPlayers: event.maxPlayers,
        portalLink: portalLink(ctx.site, event),
      }),
    );
  return entry;
}

/** Back from the checkout page: check it was paid, in case the webhook is late. */
export async function checkEntryCheckout(ctx: LessonContext, entry: EventEntry) {
  if (entry.status !== "checkout" || !entry.checkoutId) return entry;
  if (entry.provider !== ctx.payments.kind) return entry;
  const state = await ctx.payments.checkout(entry.checkoutId);
  if (state.status === "complete" && state.paymentId)
    return (await entryPaid(ctx, entry.id, state.paymentId)) ?? entry;
  return entry;
}

/** The golfer came back without paying: free the places now. */
export async function abandonEntryCheckout(ctx: LessonContext, entry: EventEntry) {
  if (entry.status !== "checkout") return;
  if (entry.checkoutId && entry.provider === ctx.payments.kind) {
    const state = await ctx.payments.checkout(entry.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await entryPaid(ctx, entry.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(entry.checkoutId);
  }
  await markEntryAbandoned(ctx.db, entry.id);
}

/* Withdrawing */

/** What the golfer gets back if they withdraw now: everything, until entries close. */
export function entryWithdrawRefund(
  entry: EventEntry,
  event: Pick<ClubEvent, "entriesClose">,
  now: Date,
): number {
  if (entry.status !== "paid") return 0;
  return eventFreeToCancel(event.entriesClose, now) ? entryTotalCents(entry) : 0;
}

/** Tell the waiting list when places free up, while entries are open. */
export async function notifyWaitlist(ctx: LessonContext, eventId: string): Promise<number> {
  const { event, where } = await eventContext(ctx, eventId);
  if (event.status !== "open" || event.entriesClose <= ctx.now) return 0;
  const left =
    event.maxPlayers - ((await placesTaken(ctx.db, [event.id], ctx.now)).get(event.id) ?? 0);
  if (left <= 0) return 0;
  const waiting = (await waitlistFor(ctx.db, event.id)).filter(
    (w) => !w.notifiedAt && w.players <= left,
  );
  for (const w of waiting)
    await send(
      ctx,
      eventPlaceFreeEmail({
        to: w.email,
        name: w.name,
        event,
        where,
        left,
        eventLink: eventLink(ctx.site, event),
      }),
    );
  await markWaitlistNotified(
    ctx.db,
    waiting.map((w) => w.id),
    ctx.now,
  );
  return waiting.length;
}

export async function withdrawEntryByGolfer(ctx: LessonContext, entry: EventEntry) {
  if (entry.status !== "paid" || !entry.paymentId) return null;
  const { event, club, where } = await eventContext(ctx, entry.eventId);
  if (event.firstStart <= ctx.now) return null;
  const refundCents = entryWithdrawRefund(entry, event, ctx.now);
  if (refundCents > 0) await ctx.payments.refund(entry.paymentId);
  const ended = await endEntry(ctx.db, entry.id, { by: "golfer", refundCents }, ctx.now);
  if (!ended) return null;
  await send(ctx, eventWithdrawnEmail({ event, entry, where, by: "golfer", refundCents }));
  for (const to of await clubInbox(ctx, club))
    await send(
      ctx,
      eventWithdrawnClubEmail({
        to,
        event,
        entry,
        refunded: refundCents > 0,
        portalLink: portalLink(ctx.site, event),
      }),
    );
  await notifyWaitlist(ctx, event.id);
  return ended;
}

/** The club takes an entry off, with or without a full refund. */
export async function withdrawEntryByClub(
  ctx: LessonContext,
  entry: EventEntry,
  options: { refund: boolean; note: string | null },
) {
  if (entry.status !== "paid" || !entry.paymentId) return null;
  const { event, where } = await eventContext(ctx, entry.eventId);
  const refundCents = options.refund ? entryTotalCents(entry) : 0;
  if (refundCents > 0) await ctx.payments.refund(entry.paymentId);
  const ended = await endEntry(ctx.db, entry.id, { by: "club", refundCents }, ctx.now);
  if (!ended) return null;
  await send(
    ctx,
    eventWithdrawnEmail({ event, entry, where, by: "club", refundCents, note: options.note }),
  );
  await notifyWaitlist(ctx, event.id);
  return ended;
}

/* Cancelling an event */

async function refundForCancelledEvent(
  ctx: LessonContext,
  entry: EventEntry,
  event: ClubEvent,
  where: { clubName: string; courseName: string },
): Promise<boolean> {
  if (!entry.paymentId) return false;
  const refundCents = entryTotalCents(entry);
  await ctx.payments.refund(entry.paymentId);
  const ended = await endEntry(ctx.db, entry.id, { by: "event", refundCents }, ctx.now);
  if (!ended) return false;
  await send(
    ctx,
    eventCancelledEmail({ event, entry, where, note: event.cancelNote, refundCents }),
  );
  return true;
}

/** Refund everyone on cancelled events. Run after cancelling, and by the worker to retry. */
async function refundCancelledEvents(ctx: LessonContext, eventId?: string): Promise<number> {
  let refunded = 0;
  for (const { entry, event } of await entriesToRefund(ctx.db, eventId)) {
    if (entry.provider !== ctx.payments.kind) continue;
    try {
      const { where } = await eventContext(ctx, event.id);
      if (await refundForCancelledEvent(ctx, entry, event, where)) refunded++;
    } catch (error) {
      console.error(`[events] could not refund ${entry.id}`, error);
    }
  }
  return refunded;
}

export async function cancelEventByClub(
  ctx: LessonContext,
  event: ClubEvent,
  note: string | null,
  actor: Actor,
): Promise<{ refunded: number } | null> {
  const cancelled = await cancelEvent(ctx.db, event, note, actor, ctx.now);
  if (!cancelled) return null;
  return { refunded: await refundCancelledEvents(ctx, event.id) };
}

/* Start sheet */

async function tellStart(
  ctx: LessonContext,
  event: ClubEvent,
  where: { clubName: string; courseName: string },
  entries: EventEntry[],
  entry: EventEntry,
  changed: boolean,
) {
  const playingWith = entries
    .filter((e) => e.startGroup === entry.startGroup && e.id !== entry.id)
    .flatMap((e) => e.players.map((p) => p.name));
  await send(
    ctx,
    eventStartEmail({
      event,
      entry,
      where,
      playingWith,
      changed,
      manageLink: entryManageLink(ctx.site, entry),
    }),
  );
}

/** Publish the start sheet and email everyone their start. */
export async function publishStartSheetAndTell(
  ctx: LessonContext,
  event: ClubEvent,
  actor: Actor,
): Promise<number> {
  const firstTime = !event.startSheetPublishedAt;
  const published = await publishStartSheet(ctx.db, event, actor, ctx.now);
  const { where } = await eventContext(ctx, event.id);
  const entries = await entriesForEvent(ctx.db, event.id);
  for (const entry of entries) await tellStart(ctx, published, where, entries, entry, !firstTime);
  return entries.length;
}

/** Move an entry to another group. Once published, the moved team is told its new start. */
export async function moveEntryAndTell(
  ctx: LessonContext,
  event: ClubEvent,
  entryId: string,
  group: number,
): Promise<EventEntry> {
  const before = (await entriesForEvent(ctx.db, event.id)).find((e) => e.id === entryId);
  const moved = await moveEntryToGroup(ctx.db, event, entryId, group);
  if (event.startSheetPublishedAt && before?.startGroup !== group) {
    const { where } = await eventContext(ctx, event.id);
    const entries = await entriesForEvent(ctx.db, event.id);
    await tellStart(ctx, event, where, entries, moved, true);
  }
  return moved;
}

/* Worker */

async function closeEntryCheckout(ctx: LessonContext, entry: EventEntry) {
  if (entry.checkoutId && entry.provider === ctx.payments.kind && ctx.payments.kind === "stripe") {
    const state = await ctx.payments.checkout(entry.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await entryPaid(ctx, entry.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(entry.checkoutId);
  }
  await markEntryAbandoned(ctx.db, entry.id);
}

/**
 * Run often (the worker does, every check): close checkouts left open, tell
 * clubs when entries close, remind entrants the day before, and refund
 * anyone on a cancelled event.
 */
export async function tidyEvents(ctx: LessonContext) {
  let closed = 0;
  let notices = 0;
  let reminders = 0;
  for (const entry of await staleEntryCheckouts(ctx.db, ctx.now)) {
    try {
      await closeEntryCheckout(ctx, entry);
      closed++;
      // Places held by an unpaid checkout may have been all that stood in the waiting list's way.
      await notifyWaitlist(ctx, entry.eventId);
    } catch (error) {
      console.error(`[events] could not close checkout for ${entry.id}`, error);
    }
  }
  for (const event of await eventsJustClosed(ctx.db, ctx.now)) {
    try {
      const { club } = await eventContext(ctx, event.id);
      const entries = await entriesForEvent(ctx.db, event.id);
      for (const to of await clubInbox(ctx, club))
        await send(
          ctx,
          eventClosedClubEmail({
            to,
            event,
            entries: entries.length,
            players: entries.reduce((n, e) => n + e.playerCount, 0),
            maxPlayers: event.maxPlayers,
            portalLink: portalLink(ctx.site, event),
          }),
        );
      await markClosedNotice(ctx.db, event.id, ctx.now);
      notices++;
    } catch (error) {
      console.error(`[events] could not tell the club entries closed for ${event.id}`, error);
    }
  }
  for (const event of await eventsDueReminder(ctx.db, ctx.now)) {
    try {
      const { where } = await eventContext(ctx, event.id);
      for (const entry of await entriesForEvent(ctx.db, event.id))
        await send(
          ctx,
          eventReminderEmail({ event, entry, where, manageLink: entryManageLink(ctx.site, entry) }),
        );
      await markReminderSent(ctx.db, event.id, ctx.now);
      reminders++;
    } catch (error) {
      console.error(`[events] could not send reminders for ${event.id}`, error);
    }
  }
  const refunded = await refundCancelledEvents(ctx);
  return { closed, notices, reminders, refunded };
}
