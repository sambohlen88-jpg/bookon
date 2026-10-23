import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TEAM_NAME,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  googleCalendarEventLink,
  groupStartLabel,
  perthDate,
  type TeamSize,
} from "@bookon/core";
import { entryByToken, entryTotalCents, listedEvent, type EventEntry } from "@bookon/db";
import { eventCalendarEvent, eventPlace } from "@bookon/email";
import { checkEntryCheckout, entryWithdrawRefund } from "@bookon/payments";
import { withdrawFromLink } from "@/app/entries/[token]/actions";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your entry · BookOn", robots: { index: false } };

const HEADLINE: Record<EventEntry["status"], string> = {
  checkout: "Waiting for payment",
  paid: "You're entered",
  withdrawn: "Withdrawn",
  cancelled: "Event cancelled",
  abandoned: "Not entered",
};

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

/** The golfer's own page for an event entry, from the link in their emails (Milestone 21). */
export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { token } = await params;
  const query = await searchParams;
  let entry = await entryByToken(db, token);
  if (!entry) notFound();
  const ctx = await lessonContext();
  // Back from Stripe: check the payment went through, in case its message hasn't arrived yet.
  if (ctx && entry.status === "checkout") entry = await checkEntryCheckout(ctx, entry);
  const now = ctx?.now ?? new Date();
  const event = (await listedEvent(db, entry.eventId, now))!;
  const total = entryTotalCents(entry);
  const going = entry.status === "paid" && event.status === "open";
  const upcoming = event.firstStart > now;
  const refund = entryWithdrawRefund(entry, event, now);
  const where = { clubName: event.clubName, courseName: event.courseName };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6 md:pt-10">
        <p className="text-sm font-medium text-muted">
          {event.title}, {event.clubName}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{HEADLINE[entry.status]}</h1>

        <div className="mt-4 flex flex-col gap-3">
          {query.withdrawn && <Notice tone="info">Done. We&apos;ve emailed you to confirm.</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {entry.status === "checkout" && (
            <Notice tone="info">
              {query.paid
                ? "We're checking your payment with Stripe. Refresh this page in a moment."
                : "This entry hasn't been paid for."}
            </Notice>
          )}
          {going && (
            <Notice tone="info">
              Your card was charged {formatPrice(total)}.{" "}
              {entry.startGroup && event.startSheetPublishedAt
                ? `Your start: ${groupStartLabel(event, entry.startGroup)}.`
                : "We'll email your start time once the club makes the start sheet."}
            </Notice>
          )}
          {entry.status === "withdrawn" && (
            <Notice tone="info">
              {entry.cancelledBy === "club"
                ? `${event.clubName} withdrew this entry. `
                : "You withdrew this entry. "}
              {entry.refundCents > 0
                ? `${formatPrice(entry.refundCents)} was refunded to your card.`
                : "It wasn't refunded."}
            </Notice>
          )}
          {entry.status === "cancelled" && (
            <Notice tone="info">
              {event.clubName} cancelled the event
              {event.cancelNote ? `: "${event.cancelNote}"` : "."} You were refunded{" "}
              {formatPrice(entry.refundCents)}.
            </Notice>
          )}
          {entry.status === "paid" && event.status === "cancelled" && (
            <Notice tone="info">
              The club cancelled the event. Your refund of {formatPrice(total)} is on its way.
            </Notice>
          )}
          {entry.status === "abandoned" && (
            <Notice tone="info">This entry wasn&apos;t paid for, so it didn&apos;t go in.</Notice>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border p-4">
          <dt className="text-muted">Event</dt>
          <dd>
            <Link href={`/competitions/${event.id}`} className="text-brand">
              {event.title}
            </Link>
          </dd>
          <dt className="text-muted">Day</dt>
          <dd>
            {formatPerthDay(event.date)}
            {entry.startGroup && event.startSheetPublishedAt
              ? `, ${groupStartLabel(event, entry.startGroup)}`
              : event.startType === "shotgun"
                ? `, ${formatPerthTime(event.firstStart)} shotgun`
                : `, tee times from ${formatPerthTime(event.firstStart)}`}
          </dd>
          <dt className="text-muted">Where</dt>
          <dd>{eventPlace(where)}</dd>
          <dt className="text-muted">Format</dt>
          <dd>
            {TEAM_NAME[event.teamSize as TeamSize]}, {event.holes} holes
          </dd>
          <dt className="text-muted">Players</dt>
          <dd>
            {entry.players.map((p, i) => (
              <span key={i} className="block">
                {p.name}
                {p.memberNumber && <span className="text-muted"> · member {p.memberNumber}</span>}
              </span>
            ))}
          </dd>
          <dt className="text-muted">Paid</dt>
          <dd className="tabular-nums">
            {formatPrice(entry.feesCents)} + {formatPrice(entry.bookingFeeCents)} booking fee ={" "}
            <strong>{formatPrice(total)}</strong>
          </dd>
        </dl>

        {going && upcoming && (
          <form action={withdrawFromLink} className="mt-6 rounded-xl border border-border p-4">
            <input type="hidden" name="token" value={token} />
            <h2 className="font-semibold">Can&apos;t play?</h2>
            <p className="mt-1 text-sm text-muted">
              {refund > 0
                ? `Withdraw before entries close (${when(event.entriesClose)}) for a full refund of ${formatPrice(refund)}.`
                : "Entries have closed, so withdrawing won't be refunded unless the club chooses to. It frees your places for others."}
            </p>
            <button type="submit" className={`${secondaryButton} mt-3`}>
              Withdraw {entry.playerCount > 1 ? "our entry" : "my entry"}
            </button>
          </form>
        )}

        {going && upcoming && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/entries/${token}/calendar.ics`} className={secondaryButton}>
              Add to Apple or Outlook calendar
            </a>
            <a
              href={googleCalendarEventLink(eventCalendarEvent(event, entry, where))}
              target="_blank"
              rel="noopener"
              className={secondaryButton}
            >
              Add to Google Calendar
            </a>
          </div>
        )}

        <p className="mt-6 text-sm text-muted">
          Keep this link: it&apos;s how you see or withdraw your entry. Payments are handled by
          Stripe for BookOn. Questions about the day go to {event.clubName}.
        </p>
      </main>
    </>
  );
}
