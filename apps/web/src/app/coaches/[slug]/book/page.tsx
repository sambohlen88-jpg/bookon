import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FREE_CANCEL_HOURS,
  RATE_KIND_NAME,
  bookableRates,
  bookingDates,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  hasSpecialRates,
  lessonKindName,
  lessonPlaces,
  lessonSlots,
  perthDate,
  perthToUtc,
  ratePriceOn,
  specialRatesLine,
} from "@bookon/core";
import {
  coachById,
  lessonById,
  lessonPaymentSettings,
  liveCoachBySlug,
  takenLessonTimes,
  waCalendar,
} from "@bookon/db";
import { abandonLessonCheckout, coachTakesBookings, placeLabel } from "@bookon/payments";
import { bookLesson } from "@/app/coaches/[slug]/book/actions";
import { Checkbox, Field, TextArea } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { LessonPlacePicker } from "@/components/lesson-place-picker";
import { Notice, primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { dayLabel, perthClock } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { PrivacyNote } from "@/components/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const coach = await liveCoachBySlug(getDb(), (await params).slug);
  return {
    title: coach ? `Book a lesson with ${coach.profile.name} · BookOn` : "Coach not found · BookOn",
    robots: { index: false },
  };
}

const chip =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium";
const chipOn = "border-brand bg-brand text-brand-foreground";

/**
 * Book and pay for a lesson (Milestone 15): pick the lesson, the day, the
 * time, then your details. Payment happens on the next page (Stripe's).
 */
export default async function BookLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { slug } = await params;
  const query = await searchParams;
  const live = await liveCoachBySlug(db, slug);
  if (!live) notFound();
  const coach = (await coachById(db, live.id))!;
  const ctx = await lessonContext();
  const now = ctx?.now ?? new Date();
  const first = live.profile.name.split(" ")[0];

  // Back from the checkout page without paying: free the time now.
  if (ctx && query.cancelled) {
    const left = await lessonById(db, query.cancelled);
    if (left && left.coachId === coach.id) await abandonLessonCheckout(ctx, left);
  }

  const open = ctx ? await coachTakesBookings(ctx, coach) : false;
  const rates = bookableRates(live.profile);
  const { feeCents } = await lessonPaymentSettings(db);
  const rateIndex = query.rate !== undefined ? Number(query.rate) : rates.length === 1 ? 0 : NaN;
  const rate = Number.isInteger(rateIndex) ? rates[rateIndex] : undefined;
  const taken = open ? await takenLessonTimes(db, coach.id, now) : [];
  const calendar = rate && hasSpecialRates(rate) ? await waCalendar(db) : null;
  const days = rate
    ? bookingDates(now)
        .map((date) => ({
          date,
          slots: lessonSlots(live.profile, rate.minutes, date, now, taken),
          price: calendar
            ? ratePriceOn(rate, date, calendar)
            : { cents: rate.priceCents, kind: "standard" as const },
        }))
        .filter((d) => d.slots.length > 0)
    : [];
  const day = days.find((d) => d.date === query.date);
  const start =
    day && query.time && /^\d{2}:\d{2}$/.test(query.time)
      ? day.slots.find((s) => s.getTime() === perthToUtc(day.date, query.time!).getTime())
      : undefined;
  const user = start ? await currentUser() : null;
  // Where this lesson is taught (Milestone 26), and whether the coach comes to the golfer.
  const where = rate ? lessonPlaces(live.profile, rate) : { places: [], playerChoice: false };
  const places = where.places.map(placeLabel);
  const link = (q: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, String(v));
    return `/coaches/${slug}/book?${p}`;
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href={`/coaches/${slug}`} className="text-sm font-medium text-brand">
          ← {live.profile.name}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Book a lesson with {first}</h1>
        {live.sample && (
          <p className="mt-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
            {live.profile.name} is a made-up coach, so you can try booking. Payments here are
            practice only.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {query.cancelled && (
            <Notice tone="info">
              No problem, you haven&apos;t paid anything. Pick a time below.
            </Notice>
          )}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        </div>

        {!open || rates.length === 0 ? (
          <div className="mt-6">
            <Notice tone="info">
              {first} isn&apos;t taking bookings through BookOn right now. You can still message{" "}
              {first} from their page.
            </Notice>
          </div>
        ) : (
          <ol className="mt-6 flex flex-col gap-6">
            <li>
              <h2 className="text-lg font-semibold">1. Lesson</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {rates.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={link({ rate: i })}
                      aria-current={i === rateIndex ? "true" : undefined}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-2 ${
                        i === rateIndex ? "border-brand bg-surface font-semibold" : "border-border"
                      }`}
                    >
                      <span>
                        {r.name}
                        <span className="block text-sm font-normal text-muted">
                          {[
                            lessonKindName(r.kind) !== r.name ? lessonKindName(r.kind) : null,
                            `${r.minutes} min`,
                            r.people === "2" ? "for 2 people" : "just you",
                            lessonPlaces(live.profile, r).playerChoice ? "comes to you" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {hasSpecialRates(r) && (
                          <span className="block text-sm font-normal text-muted">
                            {specialRatesLine(r)}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">{formatPrice(r.priceCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {rate && (
              <li>
                <h2 className="text-lg font-semibold">2. Day</h2>
                {days.length === 0 ? (
                  <p className="mt-2 text-muted">
                    No free times in the next four weeks. Try another lesson, or message {first}.
                  </p>
                ) : (
                  <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {days.map((d) => (
                      <li key={d.date}>
                        <Link
                          href={link({ rate: rateIndex, date: d.date })}
                          aria-current={d.date === day?.date ? "true" : undefined}
                          className={`flex h-full flex-col items-center rounded-lg border py-2 text-sm ${
                            d.date === day?.date ? chipOn : "border-border"
                          }`}
                        >
                          <span>{dayLabel(d.date)}</span>
                          <span className="text-lg font-semibold">{Number(d.date.slice(8))}</span>
                          <span className="text-xs">
                            {formatPerthDay(d.date).split(" ").at(-1)}
                          </span>
                          {d.price.kind !== "standard" && (
                            <span className="text-xs font-semibold tabular-nums">
                              {formatPrice(d.price.cents)}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}

            {rate && day && (
              <li>
                <h2 className="text-lg font-semibold">3. Time on {formatPerthDay(day.date)}</h2>
                {day.price.kind !== "standard" && (
                  <p className="mt-1 text-sm text-muted">
                    {RATE_KIND_NAME[day.price.kind]}: {formatPrice(day.price.cents)}
                  </p>
                )}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {day.slots.map((s) => (
                    <li key={s.getTime()}>
                      <Link
                        href={link({ rate: rateIndex, date: day.date, time: perthClock(s) })}
                        aria-current={s.getTime() === start?.getTime() ? "true" : undefined}
                        className={`${chip} ${s.getTime() === start?.getTime() ? chipOn : ""}`}
                      >
                        {formatPerthTime(s)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}

            {rate && day && start && (
              <li>
                <h2 className="text-lg font-semibold">4. Your details</h2>
                <form action={bookLesson} className="mt-3 flex flex-col gap-4">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="rate" value={rateIndex} />
                  <input type="hidden" name="start" value={start.toISOString()} />
                  <Field
                    label="Your name"
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
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
                    hint={`So ${first} can reach you about the lesson.`}
                  />
                  <LessonPlacePicker
                    places={places}
                    playerChoice={where.playerChoice}
                    coach={first}
                  />
                  <TextArea
                    label={`Anything ${first} should know`}
                    name="note"
                    maxLength={500}
                    hint="For example what you'd like to work on, or if you need to borrow clubs."
                  />

                  <section
                    aria-label="Summary"
                    className="rounded-xl border border-border bg-surface p-4 text-sm"
                  >
                    <p className="font-semibold">
                      {rate.name}, {rate.minutes} min with {live.profile.name}
                    </p>
                    <p className="mt-1">
                      {formatPerthDay(perthDate(start))} at {formatPerthTime(start)}
                      {places.length === 1 && !where.playerChoice ? ` · ${places[0]}` : ""}
                    </p>
                    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
                      <dt>
                        Lesson
                        {day.price.kind !== "standard" &&
                          ` (${RATE_KIND_NAME[day.price.kind].toLowerCase()})`}
                      </dt>
                      <dd>{formatPrice(day.price.cents)}</dd>
                      <dt>Booking fee</dt>
                      <dd>{formatPrice(feeCents)}</dd>
                      <dt className="font-semibold">Total</dt>
                      <dd className="font-semibold">{formatPrice(day.price.cents + feeCents)}</dd>
                    </dl>
                    <ul className="mt-3 list-disc pl-5 text-muted">
                      <li>
                        Your card is held, not charged, until {first} accepts. If {first} can&apos;t
                        make it, or doesn&apos;t answer within 48 hours, the hold is released.
                      </li>
                      <li>
                        Cancel up to {FREE_CANCEL_HOURS} hours before for a full refund. After that,
                        it can&apos;t be refunded.
                      </li>
                      <li>
                        {first} gets the full lesson price. The booking fee keeps BookOn going.
                      </li>
                    </ul>
                  </section>
                  <Checkbox name="agree" value="yes" required>
                    I agree to the cancellation rule above, and to BookOn sharing my name, email and
                    mobile with {first} for this lesson.
                  </Checkbox>
                  <PrivacyNote />
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
            )}
          </ol>
        )}
      </main>
    </>
  );
}
