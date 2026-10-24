import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import {
  coachById,
  entryById,
  entryTotalCents,
  eventById,
  groupBookingById,
  groupBookingTotalCents,
  groupSessionById,
  lessonById,
  lessonTotalCents,
  compById,
  mpEntryById,
} from "@bookon/db";
import { practicePay, practiceLeave } from "@/app/dev/practice-pay/[id]/actions";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonPayments } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Practice checkout · BookOn", robots: { index: false } };

/**
 * Stands in for Stripe's checkout page on a local database with no Stripe
 * keys, so booking a lesson or group session can be tried without moving money.
 */
export default async function PracticePayPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await lessonPayments())?.kind !== "practice") notFound();
  const db = getDb();
  const { id } = await params;
  const now = new Date();
  const checkout = await practiceCheckout(db, id);
  if (!checkout) notFound();
  const open =
    checkout.status === "checkout" && checkout.expiresAt !== null && checkout.expiresAt > now;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <p className="inline-block rounded-full bg-warning-bg px-3 py-1 text-sm font-semibold text-warning-fg">
          Practice: no money moves
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-2 text-muted">
          On the real site this is Stripe&apos;s secure page, where the golfer enters their card or
          uses Apple Pay or Google Pay.
        </p>
        <div className="mt-6 rounded-xl border border-border p-4">
          <p className="font-semibold">{checkout.title}</p>
          {checkout.startTime && (
            <p className="mt-1 text-sm">
              {formatPerthDay(perthDate(checkout.startTime))}, {formatPerthTime(checkout.startTime)}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
            <dt>{checkout.item}</dt>
            <dd>{formatPrice(checkout.itemCents)}</dd>
            <dt>BookOn booking fee</dt>
            <dd>{formatPrice(checkout.feeCents)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="font-semibold">{formatPrice(checkout.totalCents)}</dd>
          </dl>
        </div>
        {open ? (
          <div className="mt-6 flex flex-col gap-3">
            <form action={practicePay}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className={`${primaryButton} w-full`}>
                {checkout.group ? "Pay" : "Hold"} {formatPrice(checkout.totalCents)} (practice)
              </button>
            </form>
            <form action={practiceLeave}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className={`${secondaryButton} w-full`}>
                Back, without paying
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6">
            <Notice tone="info">This checkout has closed.</Notice>
          </div>
        )}
      </main>
    </>
  );
}

/** A lesson, group booking, event or match play entry at checkout, as the practice page shows it. */
async function practiceCheckout(
  db: ReturnType<typeof getDb>,
  id: string,
): Promise<{
  group: boolean;
  title: string;
  startTime: Date | null;
  item: string;
  itemCents: number;
  feeCents: number;
  totalCents: number;
  status: string;
  expiresAt: Date | null;
} | null> {
  const lesson = await lessonById(db, id);
  if (lesson) {
    const coach = await coachById(db, lesson.coachId);
    return {
      group: false,
      title: `${lesson.rate.name}, ${lesson.rate.minutes} min with ${coach?.profile?.name}`,
      startTime: lesson.startTime,
      item: "Lesson",
      itemCents: lesson.lessonCents,
      feeCents: lesson.feeCents,
      totalCents: lessonTotalCents(lesson),
      status: lesson.status,
      expiresAt: lesson.checkoutExpiresAt,
    };
  }
  const entry = await entryById(db, id);
  if (entry) {
    const event = await eventById(db, entry.eventId);
    if (!event) return null;
    return {
      group: true,
      title: event.title,
      startTime: event.firstStart,
      item: `Entry fees, ${entry.playerCount} ${entry.playerCount === 1 ? "player" : "players"}`,
      itemCents: entry.feesCents,
      feeCents: entry.bookingFeeCents,
      totalCents: entryTotalCents(entry),
      status: entry.status,
      expiresAt: entry.checkoutExpiresAt,
    };
  }
  const mp = await mpEntryById(db, id);
  if (mp) {
    const comp = await compById(db, mp.compId);
    if (!comp) return null;
    return {
      group: true,
      title: comp.title,
      startTime: null,
      item: `Entry fees, ${mp.players.length} ${mp.players.length === 1 ? "player" : "players"}`,
      itemCents: mp.feesCents,
      feeCents: mp.bookingFeeCents,
      totalCents: mp.feesCents + mp.bookingFeeCents,
      status: mp.status,
      expiresAt: mp.checkoutExpiresAt,
    };
  }
  const booking = await groupBookingById(db, id);
  const session = booking ? await groupSessionById(db, booking.sessionId) : null;
  if (!booking || !session) return null;
  const coach = await coachById(db, session.coachId);
  return {
    group: true,
    title: `${session.title} with ${coach?.profile?.name}`,
    startTime: session.startTime,
    item: `${booking.spots} ${booking.spots === 1 ? "spot" : "spots"}`,
    itemCents: booking.spotsCents,
    feeCents: booking.feeCents,
    totalCents: groupBookingTotalCents(booking),
    status: booking.status,
    expiresAt: booking.checkoutExpiresAt,
  };
}
