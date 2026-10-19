import { bookableRates, freeToCancel, lessonSlots, perthDate, type CoachRate } from "@bookon/core";
import {
  acceptLesson,
  cancelLesson,
  coachById,
  createLessonBooking,
  declineLesson,
  lapseLesson,
  lessonByCheckout,
  lessonPaymentSettings,
  lessonTotalCents,
  markLessonAbandoned,
  markLessonRequested,
  overdueLessonRequests,
  setCoachPaymentAccount,
  setCoachPaymentsReady,
  setLessonCheckout,
  staleLessonCheckouts,
  takenLessonTimes,
  type Coach,
  type Database,
  type LessonBooking,
} from "@bookon/db";
import {
  lessonCancelledByCoachEmail,
  lessonCancelledCoachEmail,
  lessonCancelledEmail,
  lessonConfirmedEmail,
  lessonDeclinedEmail,
  lessonLapsedCoachEmail,
  lessonLapsedEmail,
  lessonName,
  lessonRequestCoachEmail,
  lessonRequestedEmail,
  lessonWhen,
  type EmailMessage,
  type Mailer,
} from "@bookon/email";
import { PaymentError, usableAccount, type PaymentProvider, type WebhookEvent } from "./provider";

/**
 * The steps of booking a lesson, from checkout to the lesson (Milestone 15).
 * Money moves first, then the booking: if Stripe says no, the booking stays
 * as it was and the person sees why.
 */
export interface LessonContext {
  db: Database;
  payments: PaymentProvider;
  mailer: Mailer;
  /** The site's address, for links in emails. */
  site: string;
  now: Date;
}

/** Why a booking couldn't start; the message is for the golfer. */
export class BookingProblem extends Error {}

export function manageLink(site: string, booking: Pick<LessonBooking, "manageToken">): string {
  return `${site}/lessons/${booking.manageToken}`;
}

async function send(ctx: LessonContext, message: EmailMessage): Promise<void> {
  try {
    await ctx.mailer.send(message);
  } catch (error) {
    // A lost email mustn't undo a payment that already happened.
    console.error(`[lessons] could not email ${message.to}: ${message.subject}`, error);
  }
}

async function coachOf(ctx: LessonContext, booking: LessonBooking): Promise<Coach> {
  const coach = await coachById(ctx.db, booking.coachId);
  if (!coach) throw new Error(`Coach ${booking.coachId} is missing`);
  return coach;
}

function nameOf(coach: Coach): string {
  return coach.profile?.name ?? coach.email;
}

/** Whether golfers can book this coach right now. */
export async function coachTakesBookings(
  ctx: Pick<LessonContext, "db" | "payments">,
  coach: Coach,
) {
  const settings = await lessonPaymentSettings(ctx.db);
  return (
    settings.enabled &&
    coach.status === "live" &&
    coach.profile !== null &&
    coach.takesBookings &&
    coach.paymentsReady &&
    usableAccount(ctx.payments, coach.paymentAccountId)
  );
}

export interface LessonRequest {
  coach: Coach;
  /** Which of the coach's bookable rates, by position. */
  rateIndex: number;
  startTime: Date;
  place: string;
  golferName: string;
  golferEmail: string;
  golferPhone: string;
  note?: string;
  userId?: string | null;
}

/** Check the request, hold the time, and open the checkout page. Returns where to send the golfer. */
export async function startLessonCheckout(
  ctx: LessonContext,
  request: LessonRequest,
): Promise<string> {
  const { coach } = request;
  if (!(await coachTakesBookings(ctx, coach)))
    throw new BookingProblem(`${nameOf(coach)} isn't taking bookings through BookOn right now.`);
  const profile = coach.profile!;
  const rate: CoachRate | undefined = bookableRates(profile)[request.rateIndex];
  if (!rate) throw new BookingProblem("Pick a lesson.");
  if (!profile.places.some((p) => placeLabel(p) === request.place))
    throw new BookingProblem("Pick where you'd like the lesson.");
  const taken = await takenLessonTimes(ctx.db, coach.id, ctx.now);
  const slots = lessonSlots(profile, rate.minutes, perthDate(request.startTime), ctx.now, taken);
  if (!slots.some((s) => s.getTime() === request.startTime.getTime()))
    throw new BookingProblem("Sorry, that time isn't free any more. Please pick another.");

  const { feeCents } = await lessonPaymentSettings(ctx.db);
  const booking = await createLessonBooking(
    ctx.db,
    {
      coachId: coach.id,
      rate,
      startTime: request.startTime,
      place: request.place,
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
  try {
    const checkout = await ctx.payments.createCheckout({
      bookingId: booking.id,
      description: `${lessonName(booking)} with ${profile.name}, ${lessonWhen(booking.startTime)}`,
      lessonCents: booking.lessonCents,
      feeCents: booking.feeCents,
      accountId: coach.paymentAccountId!,
      email: booking.golferEmail,
      successUrl: `${manageLink(ctx.site, booking)}?paid=1`,
      cancelUrl: `${ctx.site}/coaches/${coach.slug}/book?cancelled=${booking.id}`,
      expiresAt: booking.checkoutExpiresAt,
    });
    await setLessonCheckout(ctx.db, booking.id, checkout.id);
    return checkout.url;
  } catch (error) {
    await markLessonAbandoned(ctx.db, booking.id);
    throw error;
  }
}

/** How a teaching place is written on a booking: "Collier Park Golf Course, Como". */
export function placeLabel(place: { name: string; suburb: string }): string {
  return place.suburb ? `${place.name}, ${place.suburb}` : place.name;
}

/** The golfer's card is held: send the request to the coach. Safe to call more than once. */
export async function lessonPaid(
  ctx: LessonContext,
  bookingId: string,
  paymentId: string,
): Promise<LessonBooking | null> {
  const booking = await markLessonRequested(ctx.db, bookingId, paymentId, ctx.now);
  if (!booking) return null;
  const coach = await coachOf(ctx, booking);
  await send(
    ctx,
    lessonRequestedEmail({
      lesson: booking,
      coachName: nameOf(coach),
      respondBy: booking.respondBy!,
      manageLink: manageLink(ctx.site, booking),
    }),
  );
  await send(
    ctx,
    lessonRequestCoachEmail({
      to: coach.email,
      lesson: booking,
      coachName: nameOf(coach),
      respondBy: booking.respondBy!,
      portalLink: `${ctx.site}/coach#lessons`,
    }),
  );
  return booking;
}

/**
 * Back from Stripe's checkout page: check with Stripe whether it was paid,
 * in case the webhook hasn't arrived yet.
 */
export async function checkLessonCheckout(ctx: LessonContext, booking: LessonBooking) {
  if (booking.status !== "checkout" || !booking.checkoutId) return booking;
  if (booking.provider !== ctx.payments.kind) return booking;
  const state = await ctx.payments.checkout(booking.checkoutId);
  if (state.status === "complete" && state.paymentId) {
    return (await lessonPaid(ctx, booking.id, state.paymentId)) ?? booking;
  }
  return booking;
}

export async function acceptLessonRequest(ctx: LessonContext, booking: LessonBooking) {
  if (booking.status !== "requested" || !booking.paymentId) return null;
  if (booking.respondBy && booking.respondBy <= ctx.now)
    throw new PaymentError("This request has lapsed, so it can't be accepted.");
  await ctx.payments.capture(booking.paymentId);
  const accepted = await acceptLesson(ctx.db, booking.id, ctx.now);
  if (!accepted) {
    // It moved on while the card was charged (it lapsed, or the golfer cancelled): give it back.
    await ctx.payments.refund(booking.paymentId);
    return null;
  }
  const coach = await coachOf(ctx, accepted);
  await send(
    ctx,
    lessonConfirmedEmail({
      lesson: accepted,
      coachName: nameOf(coach),
      coachContact: {
        phone: coach.profile?.contact.phone ?? coach.profile?.contact.whatsapp,
        email: coach.profile?.contact.email,
      },
      manageLink: manageLink(ctx.site, accepted),
    }),
  );
  return accepted;
}

export async function declineLessonRequest(
  ctx: LessonContext,
  booking: LessonBooking,
  note: string | null,
) {
  if (booking.status !== "requested" || !booking.paymentId) return null;
  await ctx.payments.release(booking.paymentId);
  const declined = await declineLesson(ctx.db, booking.id, note, ctx.now);
  if (!declined) return null;
  const coach = await coachOf(ctx, declined);
  await send(
    ctx,
    lessonDeclinedEmail({
      lesson: declined,
      coachName: nameOf(coach),
      note,
      coachPage: `${ctx.site}/coaches/${coach.slug}`,
    }),
  );
  return declined;
}

async function lapseLessonRequest(ctx: LessonContext, booking: LessonBooking) {
  if (booking.paymentId) await ctx.payments.release(booking.paymentId);
  const lapsed = await lapseLesson(ctx.db, booking.id, ctx.now);
  if (!lapsed) return null;
  const coach = await coachOf(ctx, lapsed);
  await send(
    ctx,
    lessonLapsedEmail({
      lesson: lapsed,
      coachName: nameOf(coach),
      coachPage: `${ctx.site}/coaches/${coach.slug}`,
    }),
  );
  await send(
    ctx,
    lessonLapsedCoachEmail({ to: coach.email, lesson: lapsed, coachName: nameOf(coach) }),
  );
  return lapsed;
}

/** What the golfer gets back if they cancel now. */
export function golferCancelRefund(booking: LessonBooking, now: Date): number {
  if (booking.status !== "confirmed") return 0;
  return freeToCancel(booking.startTime, now) ? lessonTotalCents(booking) : 0;
}

export async function cancelLessonByGolfer(ctx: LessonContext, booking: LessonBooking) {
  if (!booking.paymentId || (booking.status !== "requested" && booking.status !== "confirmed"))
    return null;
  const wasConfirmed = booking.status === "confirmed";
  const refundCents = golferCancelRefund(booking, ctx.now);
  if (!wasConfirmed) await ctx.payments.release(booking.paymentId);
  else if (refundCents > 0) await ctx.payments.refund(booking.paymentId);
  const cancelled = await cancelLesson(ctx.db, booking.id, { by: "golfer", refundCents }, ctx.now);
  if (!cancelled) return null;
  const coach = await coachOf(ctx, cancelled);
  await send(
    ctx,
    lessonCancelledEmail({
      lesson: cancelled,
      coachName: nameOf(coach),
      refundCents,
      wasCharged: wasConfirmed,
    }),
  );
  await send(
    ctx,
    lessonCancelledCoachEmail({
      to: coach.email,
      lesson: cancelled,
      coachName: nameOf(coach),
      refunded: refundCents > 0,
      wasConfirmed,
    }),
  );
  return cancelled;
}

/** The coach can't make a booked lesson: the golfer gets everything back. */
export async function cancelLessonByCoach(
  ctx: LessonContext,
  booking: LessonBooking,
  note: string | null,
) {
  if (booking.status !== "confirmed" || !booking.paymentId) return null;
  const refundCents = lessonTotalCents(booking);
  await ctx.payments.refund(booking.paymentId);
  const cancelled = await cancelLesson(
    ctx.db,
    booking.id,
    { by: "coach", refundCents, note },
    ctx.now,
  );
  if (!cancelled) return null;
  const coach = await coachOf(ctx, cancelled);
  await send(
    ctx,
    lessonCancelledByCoachEmail({
      lesson: cancelled,
      coachName: nameOf(coach),
      note,
      refundCents,
      coachPage: `${ctx.site}/coaches/${coach.slug}`,
    }),
  );
  return cancelled;
}

/**
 * The golfer came back from the checkout page without paying: close it, so
 * the time is free again straight away rather than in 30 minutes.
 */
export async function abandonLessonCheckout(ctx: LessonContext, booking: LessonBooking) {
  if (booking.status !== "checkout") return;
  if (booking.checkoutId && booking.provider === ctx.payments.kind) {
    const state = await ctx.payments.checkout(booking.checkoutId);
    // Paid after all (say, in another tab): keep it.
    if (state.status === "complete" && state.paymentId) {
      await lessonPaid(ctx, booking.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(booking.checkoutId);
  }
  await markLessonAbandoned(ctx.db, booking.id);
}

/** A checkout past its time: record the payment if it went through, otherwise free the time. */
async function closeCheckout(ctx: LessonContext, booking: LessonBooking) {
  if (
    booking.checkoutId &&
    booking.provider === ctx.payments.kind &&
    ctx.payments.kind === "stripe"
  ) {
    const state = await ctx.payments.checkout(booking.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await lessonPaid(ctx, booking.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(booking.checkoutId);
  }
  await markLessonAbandoned(ctx.db, booking.id);
}

/**
 * Run often (the worker does, every check): close checkouts left open and
 * lapse requests the coach didn't answer in time.
 */
export async function tidyLessons(ctx: LessonContext): Promise<{ closed: number; lapsed: number }> {
  let closed = 0;
  let lapsed = 0;
  for (const booking of await staleLessonCheckouts(ctx.db, ctx.now)) {
    try {
      await closeCheckout(ctx, booking);
      closed++;
    } catch (error) {
      console.error(`[lessons] could not close checkout for ${booking.id}`, error);
    }
  }
  for (const booking of await overdueLessonRequests(ctx.db, ctx.now)) {
    if (booking.provider !== ctx.payments.kind) continue;
    try {
      if (await lapseLessonRequest(ctx, booking)) lapsed++;
    } catch (error) {
      console.error(`[lessons] could not lapse ${booking.id}`, error);
    }
  }
  return { closed, lapsed };
}

/** Act on a webhook from Stripe. */
export async function handlePaymentEvent(ctx: LessonContext, event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "checkout.complete": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) await lessonPaid(ctx, booking.id, event.paymentId);
      return;
    }
    case "checkout.expired": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) await markLessonAbandoned(ctx.db, booking.id);
      return;
    }
    case "account.updated":
      await setCoachPaymentsReady(ctx.db, event.accountId, event.ready, ctx.now);
      return;
    case "ignored":
      return;
  }
}

/** Where to send a coach to set up (or finish setting up) their payment account. */
export async function coachPaymentsSetupLink(
  ctx: LessonContext,
  coach: Coach,
  urls: { returnUrl: string; refreshUrl: string },
): Promise<string> {
  let accountId = coach.paymentAccountId;
  if (!usableAccount(ctx.payments, accountId)) {
    accountId = await ctx.payments.createAccount({ email: coach.email, name: nameOf(coach) });
    await setCoachPaymentAccount(ctx.db, coach.id, accountId, ctx.now);
  }
  return ctx.payments.onboardingLink(accountId!, urls);
}

/** Ask the provider whether the coach's account is ready, and record it. */
export async function refreshCoachPayments(ctx: LessonContext, coach: Coach): Promise<boolean> {
  if (!usableAccount(ctx.payments, coach.paymentAccountId)) return false;
  const ready = await ctx.payments.accountReady(coach.paymentAccountId!);
  if (ready !== coach.paymentsReady)
    await setCoachPaymentsReady(ctx.db, coach.paymentAccountId!, ready, ctx.now);
  return ready;
}
