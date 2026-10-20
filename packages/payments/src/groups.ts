import { GROUP_MAX_PER_ORDER, groupFreeToCancel } from "@bookon/core";
import {
  GroupSessionClosed,
  GroupSessionFull,
  bookingsToRefund,
  cancelGroupBooking,
  cancelGroupSession,
  coachById,
  createGroupBooking,
  groupBookingTotalCents,
  groupSessionById,
  lessonPaymentSettings,
  markGroupAbandoned,
  markGroupGoingAhead,
  markGroupPaid,
  paidSpots,
  sessionsDueMinimumCheck,
  setGroupCheckout,
  staleGroupCheckouts,
  type Coach,
  type GroupBooking,
  type GroupSession,
} from "@bookon/db";
import {
  groupBookedCoachEmail,
  groupBookedEmail,
  groupCalledOffCoachEmail,
  groupCancelledCoachEmail,
  groupCancelledEmail,
  groupGoingAheadCoachEmail,
  groupSessionCancelledEmail,
  lessonWhen,
  type EmailMessage,
} from "@bookon/email";
import { BookingProblem, coachTakesBookings, type LessonContext } from "./bookings";

/**
 * Group sessions (Milestone 19): golfers buy spots and are charged straight
 * away. As with lessons, money moves first, then the booking, and each step
 * only moves a booking from the state it expects.
 */

export function groupManageLink(site: string, booking: Pick<GroupBooking, "manageToken">): string {
  return `${site}/sessions/${booking.manageToken}`;
}

async function send(ctx: LessonContext, message: EmailMessage): Promise<void> {
  try {
    await ctx.mailer.send(message);
  } catch (error) {
    console.error(`[groups] could not email ${message.to}: ${message.subject}`, error);
  }
}

function nameOf(coach: Coach): string {
  return coach.profile?.name ?? coach.email;
}

async function sessionAndCoach(ctx: LessonContext, sessionId: string) {
  const session = await groupSessionById(ctx.db, sessionId);
  if (!session) throw new Error(`Group session ${sessionId} is missing`);
  const coach = await coachById(ctx.db, session.coachId);
  if (!coach) throw new Error(`Coach ${session.coachId} is missing`);
  return { session, coach };
}

export interface GroupRequest {
  coach: Coach;
  session: GroupSession;
  spots: number;
  golferName: string;
  golferEmail: string;
  golferPhone: string;
  note?: string;
  userId?: string | null;
}

/** Hold the spots and open the checkout page. Returns where to send the golfer. */
export async function startGroupCheckout(ctx: LessonContext, request: GroupRequest) {
  const { coach, session } = request;
  if (session.coachId !== coach.id) throw new BookingProblem("Pick a session.");
  if (!(await coachTakesBookings(ctx, coach)))
    throw new BookingProblem(`${nameOf(coach)} isn't taking bookings through BookOn right now.`);
  if (!Number.isInteger(request.spots) || request.spots < 1 || request.spots > GROUP_MAX_PER_ORDER)
    throw new BookingProblem(`Pick between 1 and ${GROUP_MAX_PER_ORDER} spots.`);
  const { feeCents } = await lessonPaymentSettings(ctx.db);
  let booking: GroupBooking;
  try {
    booking = await createGroupBooking(
      ctx.db,
      {
        sessionId: session.id,
        spots: request.spots,
        golferName: request.golferName,
        golferEmail: request.golferEmail,
        golferPhone: request.golferPhone,
        note: request.note,
        userId: request.userId,
        feeCents,
        provider: ctx.payments.kind,
      },
      ctx.now,
    );
  } catch (error) {
    if (error instanceof GroupSessionFull)
      throw new BookingProblem(
        error.left > 0
          ? `Sorry, only ${error.left} ${error.left === 1 ? "spot is" : "spots are"} left now.`
          : "Sorry, this session has just filled up.",
      );
    if (error instanceof GroupSessionClosed)
      throw new BookingProblem("Sorry, this session can't be booked any more.");
    throw error;
  }
  try {
    const checkout = await ctx.payments.createCheckout({
      bookingId: booking.id,
      description: `${session.title} with ${nameOf(coach)}, ${lessonWhen(session.startTime)} (${booking.spots} ${booking.spots === 1 ? "spot" : "spots"})`,
      lessonCents: booking.spotsCents,
      feeCents: booking.feeCents,
      accountId: coach.paymentAccountId!,
      email: booking.golferEmail,
      successUrl: `${groupManageLink(ctx.site, booking)}?paid=1`,
      cancelUrl: `${ctx.site}/coaches/${coach.slug}/sessions/${session.id}?cancelled=${booking.id}`,
      expiresAt: booking.checkoutExpiresAt,
      capture: "automatic",
    });
    await setGroupCheckout(ctx.db, booking.id, checkout.id);
    return checkout.url;
  } catch (error) {
    await markGroupAbandoned(ctx.db, booking.id);
    throw error;
  }
}

/**
 * The golfer has paid. Safe to call more than once. If the session was
 * called off while they were paying, they're refunded straight away.
 */
export async function groupPaid(
  ctx: LessonContext,
  bookingId: string,
  paymentId: string,
): Promise<GroupBooking | null> {
  const booking = await markGroupPaid(ctx.db, bookingId, paymentId, ctx.now);
  if (!booking) return null;
  const { session, coach } = await sessionAndCoach(ctx, booking.sessionId);
  if (session.status === "cancelled") {
    await refundForCancelledSession(ctx, booking, session, coach);
    return booking;
  }
  await send(
    ctx,
    groupBookedEmail({
      session,
      booking,
      coachName: nameOf(coach),
      coachContact: {
        phone: coach.profile?.contact.phone ?? coach.profile?.contact.whatsapp,
        email: coach.profile?.contact.email,
      },
      manageLink: groupManageLink(ctx.site, booking),
    }),
  );
  await send(
    ctx,
    groupBookedCoachEmail({
      to: coach.email,
      session,
      booking,
      coachName: nameOf(coach),
      booked: await paidSpots(ctx.db, session.id),
      spots: session.spots,
      portalLink: `${ctx.site}/coach#sessions`,
    }),
  );
  return booking;
}

/** Back from the checkout page: check whether it was paid, in case the webhook is late. */
export async function checkGroupCheckout(ctx: LessonContext, booking: GroupBooking) {
  if (booking.status !== "checkout" || !booking.checkoutId) return booking;
  if (booking.provider !== ctx.payments.kind) return booking;
  const state = await ctx.payments.checkout(booking.checkoutId);
  if (state.status === "complete" && state.paymentId)
    return (await groupPaid(ctx, booking.id, state.paymentId)) ?? booking;
  return booking;
}

/** The golfer came back without paying: free the spots now. */
export async function abandonGroupCheckout(ctx: LessonContext, booking: GroupBooking) {
  if (booking.status !== "checkout") return;
  if (booking.checkoutId && booking.provider === ctx.payments.kind) {
    const state = await ctx.payments.checkout(booking.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await groupPaid(ctx, booking.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(booking.checkoutId);
  }
  await markGroupAbandoned(ctx.db, booking.id);
}

/** What the golfer gets back if they cancel now. */
export function groupCancelRefund(
  booking: GroupBooking,
  session: Pick<GroupSession, "startTime">,
  now: Date,
): number {
  if (booking.status !== "paid") return 0;
  return groupFreeToCancel(session.startTime, now) ? groupBookingTotalCents(booking) : 0;
}

export async function cancelGroupByGolfer(ctx: LessonContext, booking: GroupBooking) {
  if (booking.status !== "paid" || !booking.paymentId) return null;
  const { session, coach } = await sessionAndCoach(ctx, booking.sessionId);
  if (session.startTime <= ctx.now) return null;
  const refundCents = groupCancelRefund(booking, session, ctx.now);
  if (refundCents > 0) await ctx.payments.refund(booking.paymentId);
  const cancelled = await cancelGroupBooking(
    ctx.db,
    booking.id,
    { by: "golfer", refundCents },
    ctx.now,
  );
  if (!cancelled) return null;
  await send(ctx, groupCancelledEmail({ session, booking, coachName: nameOf(coach), refundCents }));
  await send(
    ctx,
    groupCancelledCoachEmail({
      to: coach.email,
      session,
      booking,
      coachName: nameOf(coach),
      refunded: refundCents > 0,
    }),
  );
  return cancelled;
}

async function refundForCancelledSession(
  ctx: LessonContext,
  booking: GroupBooking,
  session: GroupSession,
  coach: Coach,
): Promise<boolean> {
  if (!booking.paymentId) return false;
  const refundCents = groupBookingTotalCents(booking);
  await ctx.payments.refund(booking.paymentId);
  const by = session.cancelledBy === "minimum" ? "minimum" : "coach";
  const cancelled = await cancelGroupBooking(ctx.db, booking.id, { by, refundCents }, ctx.now);
  if (!cancelled) return false;
  await send(
    ctx,
    groupSessionCancelledEmail({
      session,
      booking,
      coachName: nameOf(coach),
      reason: by,
      note: session.coachNote,
      refundCents,
      coachPage: `${ctx.site}/coaches/${coach.slug}`,
    }),
  );
  return true;
}

/**
 * Refund everyone on cancelled sessions. Run after cancelling, and by the
 * worker, so a refund that failed is tried again.
 */
async function refundCancelledSessions(ctx: LessonContext, sessionId?: string): Promise<number> {
  let refunded = 0;
  for (const { booking, session } of await bookingsToRefund(ctx.db, sessionId)) {
    if (booking.provider !== ctx.payments.kind) continue;
    try {
      const coach = await coachById(ctx.db, session.coachId);
      if (coach && (await refundForCancelledSession(ctx, booking, session, coach))) refunded++;
    } catch (error) {
      console.error(`[groups] could not refund ${booking.id}`, error);
    }
  }
  return refunded;
}

/** The coach calls off a session: it closes, and everyone who paid is refunded in full. */
export async function cancelGroupSessionByCoach(
  ctx: LessonContext,
  session: GroupSession,
  note: string | null,
): Promise<{ refunded: number } | null> {
  const cancelled = await cancelGroupSession(ctx.db, session.id, { by: "coach", note }, ctx.now);
  if (!cancelled) return null;
  return { refunded: await refundCancelledSessions(ctx, session.id) };
}

/** 24 hours before: call off sessions short of their minimum, or mark them going ahead. */
async function checkMinimums(ctx: LessonContext) {
  let calledOff = 0;
  let goingAhead = 0;
  for (const session of await sessionsDueMinimumCheck(ctx.db, ctx.now)) {
    try {
      const booked = await paidSpots(ctx.db, session.id);
      const coach = await coachById(ctx.db, session.coachId);
      if (!coach) continue;
      if (booked >= (session.minSpots ?? 0)) {
        await markGroupGoingAhead(ctx.db, session.id, ctx.now);
        goingAhead++;
        await send(
          ctx,
          groupGoingAheadCoachEmail({
            to: coach.email,
            session,
            coachName: nameOf(coach),
            booked,
            portalLink: `${ctx.site}/coach#sessions`,
          }),
        );
        continue;
      }
      const cancelled = await cancelGroupSession(ctx.db, session.id, { by: "minimum" }, ctx.now);
      if (!cancelled) continue;
      calledOff++;
      await refundCancelledSessions(ctx, session.id);
      await send(
        ctx,
        groupCalledOffCoachEmail({ to: coach.email, session, coachName: nameOf(coach), booked }),
      );
    } catch (error) {
      console.error(`[groups] could not check the minimum for ${session.id}`, error);
    }
  }
  return { calledOff, goingAhead };
}

async function closeGroupCheckout(ctx: LessonContext, booking: GroupBooking) {
  if (
    booking.checkoutId &&
    booking.provider === ctx.payments.kind &&
    ctx.payments.kind === "stripe"
  ) {
    const state = await ctx.payments.checkout(booking.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await groupPaid(ctx, booking.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(booking.checkoutId);
  }
  await markGroupAbandoned(ctx.db, booking.id);
}

/**
 * Run often (the worker does, every check): close checkouts left open,
 * check minimums 24 hours before, and refund anyone on a cancelled session.
 */
export async function tidyGroups(ctx: LessonContext) {
  let closed = 0;
  for (const booking of await staleGroupCheckouts(ctx.db, ctx.now)) {
    try {
      await closeGroupCheckout(ctx, booking);
      closed++;
    } catch (error) {
      console.error(`[groups] could not close checkout for ${booking.id}`, error);
    }
  }
  const minimums = await checkMinimums(ctx);
  const refunded = await refundCancelledSessions(ctx);
  return { closed, ...minimums, refunded };
}
