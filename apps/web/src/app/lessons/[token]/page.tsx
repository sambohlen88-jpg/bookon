import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FREE_CANCEL_HOURS,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  googleCalendarEventLink,
  perthDate,
} from "@bookon/core";
import { coachById, lessonByToken, lessonTotalCents, type LessonBooking } from "@bookon/db";
import { lessonCalendarEvent } from "@bookon/email";
import { checkLessonCheckout, golferCancelRefund } from "@bookon/payments";
import { cancelLessonFromLink } from "@/app/lessons/[token]/actions";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your lesson · BookOn", robots: { index: false } };

const HEADLINE: Record<LessonBooking["status"], string> = {
  checkout: "Waiting for payment",
  requested: "Request sent",
  confirmed: "You're booked in",
  declined: "Not this time",
  lapsed: "Request lapsed",
  cancelled: "Cancelled",
  abandoned: "Not booked",
};

/** The golfer's own page for a lesson, from the link in their emails. */
export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { token } = await params;
  const query = await searchParams;
  let booking = await lessonByToken(db, token);
  if (!booking) notFound();
  const ctx = await lessonContext();
  // Back from Stripe: check the payment went through, in case its message hasn't arrived yet.
  if (ctx && booking.status === "checkout") booking = await checkLessonCheckout(ctx, booking);
  const coach = (await coachById(db, booking.coachId))!;
  const name = coach.profile?.name ?? "Your coach";
  const first = name.split(" ")[0];
  const now = ctx?.now ?? new Date();
  const total = lessonTotalCents(booking);
  const refund = golferCancelRefund(booking, now);
  const upcoming = booking.startTime > now;
  const contact = coach.profile?.contact ?? {};

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6 md:pt-10">
        <p className="text-sm font-medium text-muted">Lesson with {name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{HEADLINE[booking.status]}</h1>

        <div className="mt-4 flex flex-col gap-3">
          {query.cancelled && <Notice tone="info">Done. We&apos;ve emailed you to confirm.</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {booking.status === "checkout" && (
            <Notice tone="info">
              {query.paid
                ? "We're checking your payment with Stripe. Refresh this page in a moment."
                : "This booking hasn't been paid for."}
            </Notice>
          )}
          {booking.status === "requested" && (
            <Notice tone="info">
              {formatPrice(total)} is held on your card, not charged. {first} will accept or decline
              by {formatPerthDay(perthDate(booking.respondBy!))},{" "}
              {formatPerthTime(booking.respondBy!)}. We&apos;ll email you either way.
            </Notice>
          )}
          {booking.status === "confirmed" && (
            <Notice tone="info">
              {first} accepted and your card was charged {formatPrice(total)}. See you there!
            </Notice>
          )}
          {booking.status === "declined" && (
            <Notice tone="info">
              {first} can&apos;t take this lesson, so the hold on your card was released.
              {booking.coachNote ? ` ${first} says: "${booking.coachNote}"` : ""}
            </Notice>
          )}
          {booking.status === "lapsed" && (
            <Notice tone="info">
              {first} didn&apos;t answer in time, so the hold on your card was released.
            </Notice>
          )}
          {booking.status === "cancelled" && (
            <Notice tone="info">
              {booking.cancelledBy === "coach"
                ? `${first} cancelled this lesson${booking.coachNote ? `: "${booking.coachNote}"` : "."} `
                : "You cancelled this lesson. "}
              {booking.refundCents > 0
                ? `${formatPrice(booking.refundCents)} was refunded to your card.`
                : booking.decidedAt
                  ? "It was cancelled less than 24 hours before, so it wasn't refunded."
                  : "You weren't charged."}
            </Notice>
          )}
          {booking.status === "abandoned" && (
            <Notice tone="info">
              This booking wasn&apos;t paid for, so it didn&apos;t go ahead.
            </Notice>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border p-4">
          <dt className="text-muted">Lesson</dt>
          <dd>
            {booking.rate.name}, {booking.rate.minutes} min
          </dd>
          <dt className="text-muted">When</dt>
          <dd>
            {formatPerthDay(perthDate(booking.startTime))}, {formatPerthTime(booking.startTime)}
          </dd>
          <dt className="text-muted">Where</dt>
          <dd>{booking.place}</dd>
          <dt className="text-muted">Coach</dt>
          <dd>
            {coach.status === "live" ? (
              <Link href={`/coaches/${coach.slug}`} className="text-brand">
                {name}
              </Link>
            ) : (
              name
            )}
          </dd>
          {booking.status === "confirmed" && (contact.phone || contact.whatsapp) && (
            <>
              <dt className="text-muted">Phone</dt>
              <dd>
                <a href={`tel:${contact.phone ?? contact.whatsapp}`} className="text-brand">
                  {formatAuPhone((contact.phone ?? contact.whatsapp)!)}
                </a>
              </dd>
            </>
          )}
          <dt className="text-muted">Price</dt>
          <dd className="tabular-nums">
            {formatPrice(booking.lessonCents)} + {formatPrice(booking.feeCents)} booking fee ={" "}
            <strong>{formatPrice(total)}</strong>
          </dd>
        </dl>

        {(booking.status === "requested" || booking.status === "confirmed") && upcoming && (
          <form action={cancelLessonFromLink} className="mt-6 rounded-xl border border-border p-4">
            <input type="hidden" name="token" value={token} />
            <h2 className="font-semibold">
              {booking.status === "requested" ? "Changed your mind?" : "Can't make it?"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {booking.status === "requested"
                ? "Withdraw the request and the hold on your card is released straight away."
                : refund > 0
                  ? `Cancel now for a full refund of ${formatPrice(refund)}. From ${FREE_CANCEL_HOURS} hours before, lessons can't be refunded.`
                  : `It's less than ${FREE_CANCEL_HOURS} hours to go, so cancelling won't be refunded. ${first} keeps the time free for you otherwise.`}
            </p>
            <button type="submit" className={`${secondaryButton} mt-3`}>
              {booking.status === "requested" ? "Withdraw request" : "Cancel lesson"}
            </button>
          </form>
        )}

        {booking.status === "confirmed" && upcoming && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/lessons/${token}/calendar.ics`} className={secondaryButton}>
              Add to Apple or Outlook calendar
            </a>
            <a
              href={googleCalendarEventLink(
                lessonCalendarEvent(booking, { for: "golfer", coachName: name }),
              )}
              target="_blank"
              rel="noopener"
              className={secondaryButton}
            >
              Add to Google Calendar
            </a>
          </div>
        )}

        <p className="mt-6 text-sm text-muted">
          Keep this link: it&apos;s how you see or cancel this booking. Payments are handled by
          Stripe for BookOn.
        </p>
      </main>
    </>
  );
}
