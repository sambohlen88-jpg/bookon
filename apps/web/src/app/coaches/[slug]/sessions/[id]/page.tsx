import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GROUP_FREE_CANCEL_HOURS,
  GROUP_MAX_PER_ORDER,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
  spotsLeftLabel,
} from "@bookon/core";
import {
  coachById,
  groupBookingById,
  groupSessionWithSpots,
  lessonPaymentSettings,
  liveCoachBySlug,
} from "@bookon/db";
import { abandonGroupCheckout, coachTakesBookings } from "@bookon/payments";
import { bookGroupSpots } from "@/app/coaches/[slug]/sessions/[id]/actions";
import { Checkbox, Field, TextArea } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const db = getDb();
  const coach = await liveCoachBySlug(db, slug);
  const session = coach ? await groupSessionWithSpots(db, id, new Date()) : null;
  return {
    title:
      coach && session && session.coachId === coach.id
        ? `${session.title} with ${coach.profile.name} · BookOn`
        : "Session not found · BookOn",
    robots: { index: false },
  };
}

const chip =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium";
const chipOn = "border-brand bg-brand text-brand-foreground";

/** Book spots at a coach's group session (Milestone 19): how many, your details, then pay. */
export default async function GroupSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { slug, id } = await params;
  const query = await searchParams;
  const live = await liveCoachBySlug(db, slug);
  if (!live) notFound();
  const ctx = await lessonContext();
  const now = ctx?.now ?? new Date();

  // Back from the checkout page without paying: free the spots now.
  if (ctx && query.cancelled) {
    const left = await groupBookingById(db, query.cancelled);
    if (left && left.sessionId === id) await abandonGroupCheckout(ctx, left);
  }

  const session = await groupSessionWithSpots(db, id, now);
  if (!session || session.coachId !== live.id) notFound();
  const coach = (await coachById(db, live.id))!;
  const first = live.profile.name.split(" ")[0];
  const open = ctx ? await coachTakesBookings(ctx, coach) : false;
  const bookable = open && session.status === "open" && session.startTime > now;
  const most = Math.min(session.left, GROUP_MAX_PER_ORDER);
  const wanted = Number(query.spots);
  const spots = Number.isInteger(wanted) && wanted >= 1 && wanted <= most ? wanted : 1;
  const { feeCents } = await lessonPaymentSettings(db);
  const user = bookable && most > 0 ? await currentUser() : null;
  const minutes = Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60_000);
  const link = (n: number) => `/coaches/${slug}/sessions/${id}?spots=${n}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href={`/coaches/${slug}`} className="text-sm font-medium text-brand">
          ← {live.profile.name}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{session.title}</h1>
        <p className="mt-1 text-lg">
          {formatPerthDay(perthDate(session.startTime))}, {formatPerthTime(session.startTime)} ·{" "}
          {minutes} min
        </p>
        <p className="text-muted">
          With {live.profile.name} · {session.place}
        </p>
        {session.details && <p className="mt-3 whitespace-pre-line">{session.details}</p>}
        <p className="mt-3">
          <strong className="tabular-nums">{formatPrice(session.priceCents)}</strong> a spot ·{" "}
          <span className={session.left > 0 ? "" : "font-semibold"}>
            {spotsLeftLabel(session.left)}
          </span>
        </p>
        {session.minSpots && !session.goingAheadAt && session.status === "open" && (
          <p className="mt-1 text-sm text-muted">
            Needs {session.minSpots} people to go ahead. If it doesn&apos;t get them by 24 hours
            before, it&apos;s called off and everyone is refunded in full automatically.
          </p>
        )}
        {live.sample && (
          <p className="mt-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
            {live.profile.name} is a made-up coach, so you can try booking. Payments here are
            practice only.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {query.cancelled && (
            <Notice tone="info">No problem, you haven&apos;t paid anything.</Notice>
          )}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        </div>

        {session.status === "cancelled" ? (
          <div className="mt-6">
            <Notice tone="info">This session has been called off.</Notice>
          </div>
        ) : !bookable ? (
          <div className="mt-6">
            <Notice tone="info">
              {session.startTime <= now
                ? "This session has already started."
                : `${first} isn't taking bookings through BookOn right now. You can still message ${first} from their page.`}
            </Notice>
          </div>
        ) : most === 0 ? (
          <div className="mt-6">
            <Notice tone="info">
              This session is full. Spots held by people paying now free up within 30 minutes if
              they don&apos;t finish, so it&apos;s worth checking back.
            </Notice>
          </div>
        ) : (
          <ol className="mt-6 flex flex-col gap-6">
            <li>
              <h2 className="text-lg font-semibold">1. How many spots</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: most }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <Link
                      href={link(n)}
                      aria-current={n === spots ? "true" : undefined}
                      className={`${chip} ${n === spots ? chipOn : ""}`}
                    >
                      {n}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <h2 className="text-lg font-semibold">2. Your details</h2>
              <form action={bookGroupSpots} className="mt-3 flex flex-col gap-4">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="session" value={session.id} />
                <input type="hidden" name="spots" value={spots} />
                <Field label="Your name" name="name" required maxLength={80} autoComplete="name" />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={user?.email}
                  hint="For your confirmation and receipt."
                />
                <Field
                  label="Mobile"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  autoComplete="tel"
                  hint={`So ${first} can reach you about the session.`}
                />
                <TextArea
                  label={spots > 1 ? "Who's coming" : `Anything ${first} should know`}
                  name="note"
                  maxLength={500}
                  hint={
                    spots > 1
                      ? "Their names, and ages for juniors."
                      : "For example your experience, or if you need to borrow clubs."
                  }
                />
                <section
                  aria-label="Summary"
                  className="rounded-xl border border-border bg-surface p-4 text-sm"
                >
                  <p className="font-semibold">
                    {session.title} with {live.profile.name}
                  </p>
                  <p className="mt-1">
                    {formatPerthDay(perthDate(session.startTime))} at{" "}
                    {formatPerthTime(session.startTime)} · {session.place}
                  </p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
                    <dt>
                      {spots} {spots === 1 ? "spot" : "spots"} at {formatPrice(session.priceCents)}
                    </dt>
                    <dd>{formatPrice(session.priceCents * spots)}</dd>
                    <dt>Booking fee</dt>
                    <dd>{formatPrice(feeCents)}</dd>
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-semibold">
                      {formatPrice(session.priceCents * spots + feeCents)}
                    </dd>
                  </dl>
                  <ul className="mt-3 list-disc pl-5 text-muted">
                    <li>Your card is charged when you book.</li>
                    <li>
                      Cancel up to {GROUP_FREE_CANCEL_HOURS} hours before for a full refund. After
                      that, it can&apos;t be refunded.
                    </li>
                    <li>If {first} calls the session off, you&apos;re refunded in full.</li>
                    <li>{first} gets the full price. The booking fee keeps BookOn going.</li>
                  </ul>
                </section>
                <Checkbox name="agree" value="yes" required>
                  I agree to the cancellation rule above, and to BookOn sharing my name, email and
                  mobile with {first} for this session.
                </Checkbox>
                <button type="submit" className={primaryButton}>
                  Continue to payment
                </button>
                <p className="text-center text-sm text-muted">
                  {ctx?.payments.kind === "practice"
                    ? "Practice payments: no money moves on this computer."
                    : "Payment is on Stripe's secure page. BookOn never sees your card."}
                </p>
              </form>
            </li>
          </ol>
        )}
      </main>
    </>
  );
}
