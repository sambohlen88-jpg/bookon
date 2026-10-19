import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import { coachById, lessonById, lessonTotalCents } from "@bookon/db";
import { practicePay, practiceLeave } from "@/app/dev/practice-pay/[id]/actions";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonPayments } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Practice checkout · BookOn", robots: { index: false } };

/**
 * Stands in for Stripe's checkout page on a local database with no Stripe
 * keys, so booking a lesson can be tried without moving money.
 */
export default async function PracticePayPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await lessonPayments())?.kind !== "practice") notFound();
  const db = getDb();
  const booking = await lessonById(db, (await params).id);
  if (!booking) notFound();
  const coach = await coachById(db, booking.coachId);
  const open = booking.status === "checkout" && booking.checkoutExpiresAt > new Date();

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
          <p className="font-semibold">
            {booking.rate.name}, {booking.rate.minutes} min with {coach?.profile?.name}
          </p>
          <p className="mt-1 text-sm">
            {formatPerthDay(perthDate(booking.startTime))}, {formatPerthTime(booking.startTime)}
          </p>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
            <dt>Lesson</dt>
            <dd>{formatPrice(booking.lessonCents)}</dd>
            <dt>BookOn booking fee</dt>
            <dd>{formatPrice(booking.feeCents)}</dd>
            <dt className="font-semibold">Total</dt>
            <dd className="font-semibold">{formatPrice(lessonTotalCents(booking))}</dd>
          </dl>
        </div>
        {open ? (
          <div className="mt-6 flex flex-col gap-3">
            <form action={practicePay}>
              <input type="hidden" name="id" value={booking.id} />
              <button type="submit" className={`${primaryButton} w-full`}>
                Hold {formatPrice(lessonTotalCents(booking))} (practice)
              </button>
            </form>
            <form action={practiceLeave}>
              <input type="hidden" name="id" value={booking.id} />
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
