import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GROUP_FREE_CANCEL_HOURS,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  googleCalendarEventLink,
  perthDate,
} from "@bookon/core";
import {
  coachById,
  groupBookingByToken,
  groupBookingTotalCents,
  groupSessionById,
  type GroupBooking,
} from "@bookon/db";
import { groupCalendarEvent } from "@bookon/email";
import { checkGroupCheckout, groupCancelRefund } from "@bookon/payments";
import { cancelGroupFromLink } from "@/app/sessions/[token]/actions";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your session · BookOn", robots: { index: false } };

const HEADLINE: Record<GroupBooking["status"], string> = {
  checkout: "Waiting for payment",
  paid: "You're booked in",
  cancelled: "Cancelled",
  abandoned: "Not booked",
};

/** The golfer's own page for their spots at a group session, from the link in their email. */
export default async function GroupBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { token } = await params;
  const query = await searchParams;
  let booking = await groupBookingByToken(db, token);
  if (!booking) notFound();
  const ctx = await lessonContext();
  // Back from Stripe: check the payment went through, in case its message hasn't arrived yet.
  if (ctx && booking.status === "checkout") booking = await checkGroupCheckout(ctx, booking);
  const session = (await groupSessionById(db, booking.sessionId))!;
  const coach = (await coachById(db, session.coachId))!;
  const name = coach.profile?.name ?? "Your coach";
  const first = name.split(" ")[0];
  const now = ctx?.now ?? new Date();
  const total = groupBookingTotalCents(booking);
  const refund = groupCancelRefund(booking, session, now);
  const upcoming = session.startTime > now;
  const going = booking.status === "paid" && session.status === "open";
  const contact = coach.profile?.contact ?? {};
  const spots = `${booking.spots} ${booking.spots === 1 ? "spot" : "spots"}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6 md:pt-10">
        <p className="text-sm font-medium text-muted">
          {session.title} with {name}
        </p>
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
          {going && (
            <Notice tone="info">
              Your card was charged {formatPrice(total)} for {spots}. See you there!
              {session.minSpots && !session.goingAheadAt
                ? ` It needs ${session.minSpots} people to go ahead. If it doesn't get them by 24 hours before, it's called off and you're refunded in full.`
                : ""}
            </Notice>
          )}
          {booking.status === "cancelled" && (
            <Notice tone="info">
              {booking.cancelledBy === "minimum"
                ? "The session didn't get enough people, so it was called off. "
                : booking.cancelledBy === "coach"
                  ? `${first} called the session off${session.coachNote ? `: "${session.coachNote}"` : "."} `
                  : "You cancelled. "}
              {booking.refundCents > 0
                ? `${formatPrice(booking.refundCents)} was refunded to your card.`
                : "It was cancelled less than 24 hours before, so it wasn't refunded."}
            </Notice>
          )}
          {booking.status === "paid" && session.status === "cancelled" && (
            <Notice tone="info">
              This session was called off. Your refund of {formatPrice(total)} is on its way.
            </Notice>
          )}
          {booking.status === "abandoned" && (
            <Notice tone="info">
              This booking wasn&apos;t paid for, so it didn&apos;t go ahead.
            </Notice>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border p-4">
          <dt className="text-muted">Session</dt>
          <dd>{session.title}</dd>
          <dt className="text-muted">When</dt>
          <dd>
            {formatPerthDay(perthDate(session.startTime))}, {formatPerthTime(session.startTime)}
          </dd>
          <dt className="text-muted">Where</dt>
          <dd>{session.place}</dd>
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
          {going && (contact.phone || contact.whatsapp) && (
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
            {spots}: {formatPrice(booking.spotsCents)} + {formatPrice(booking.feeCents)} booking fee
            = <strong>{formatPrice(total)}</strong>
          </dd>
        </dl>

        {going && upcoming && (
          <form action={cancelGroupFromLink} className="mt-6 rounded-xl border border-border p-4">
            <input type="hidden" name="token" value={token} />
            <h2 className="font-semibold">Can&apos;t make it?</h2>
            <p className="mt-1 text-sm text-muted">
              {refund > 0
                ? `Cancel now for a full refund of ${formatPrice(refund)}. From ${GROUP_FREE_CANCEL_HOURS} hours before, it can't be refunded.`
                : `It's less than ${GROUP_FREE_CANCEL_HOURS} hours to go, so cancelling won't be refunded, but it frees your ${booking.spots === 1 ? "spot" : "spots"} for someone else.`}
            </p>
            <button type="submit" className={`${secondaryButton} mt-3`}>
              Cancel my {booking.spots === 1 ? "spot" : "spots"}
            </button>
          </form>
        )}

        {going && upcoming && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/sessions/${token}/calendar.ics`} className={secondaryButton}>
              Add to Apple or Outlook calendar
            </a>
            <a
              href={googleCalendarEventLink(
                groupCalendarEvent(session, {
                  for: "golfer",
                  coachName: name,
                  spots: booking.spots,
                }),
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
