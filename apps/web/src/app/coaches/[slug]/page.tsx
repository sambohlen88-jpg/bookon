import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  WEEKDAYS,
  areaName,
  bookableRates,
  emailLink,
  formatAuPhone,
  formatPerthDay,
  formatPrice,
  hasSpecialRates,
  lessonKindName,
  lessonPlaces,
  perthDate,
  specialRatesLine,
  specialityName,
  weekDates,
  whatsappLink,
} from "@bookon/core";
import type { CoachRate } from "@bookon/core";
import { coachById, courseDetails, liveCoachBySlug, upcomingGroupSessions } from "@bookon/db";
import { coachTakesBookings } from "@bookon/payments";
import { CoachAvatar, CoachBadges } from "@/components/coach-avatar";
import { ContactLink } from "@/components/coach-contact";
import { GroupSessionList } from "@/components/group-session-list";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";
import { clockLabel, coachWeeks, dayLabel } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { lessonPayments } from "@/lib/lessons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const coach = await liveCoachBySlug(getDb(), (await params).slug);
  if (!coach) return { title: "Coach not found · BookOn" };
  return {
    title: `${coach.profile.name}, golf coach · BookOn`,
    description: `${coach.profile.headline}. Golf lessons in ${coach.profile.suburb}: rates, teaching days and how to book.`,
    // Made-up coaches stay out of search engines.
    ...(coach.sample ? { robots: { index: false } } : {}),
  };
}

const PEOPLE = { "1": "1 person", "2": "2 people", group: "per person, in a group" } as const;

export default async function CoachPage({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const coach = await liveCoachBySlug(db, (await params).slug);
  if (!coach) notFound();
  const now = new Date();
  const today = perthDate(now);
  const { profile } = coach;
  const first = profile.name.split(" ")[0];
  const weeks = coachWeeks(coach, now);
  // A lesson taught at only some places (Milestone 26) says where.
  const lessonWhere = (rate: CoachRate): string | null => {
    if (!rate.at) return null;
    const where = lessonPlaces(profile, rate);
    const everywhere =
      where.places.length === profile.places.length &&
      where.playerChoice === Boolean(profile.travel);
    if (everywhere) return null;
    const names = listNames(where.places.map((p) => p.name));
    if (!where.playerChoice) return `At ${names}`;
    return names ? `At ${names}, or wherever you choose` : "Wherever you choose";
  };
  // One after another: the local database takes one query at a time.
  const places = [];
  for (const place of profile.places) {
    const course = place.courseSlug ? await courseDetails(db, place.courseSlug) : null;
    places.push({ ...place, course });
  }
  const message = `Hi ${first}, I found you on BookOn and I'd like to book a golf lesson.`;
  const { contact } = profile;
  const directions =
    coach.latitude !== null && coach.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${coach.latitude},${coach.longitude}`
      : null;
  const awayAhead = profile.away.filter((a) => a.to >= today);
  const payments = await lessonPayments();
  const takesBookings =
    payments !== null &&
    coach.takesBookings &&
    (await coachTakesBookings({ db, payments }, (await coachById(db, coach.id))!));
  const bookable = takesBookings && bookableRates(profile).length > 0;
  // Group sessions (Milestone 19), only bookable while the coach takes bookings.
  const sessions = takesBookings
    ? (await upcomingGroupSessions(db, now, [coach.id])).slice(0, 12)
    : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_360px] md:gap-12 md:px-6 md:pt-12">
        <div className="min-w-0">
          <Link href="/coaches" className="text-sm font-medium text-brand">
            ← All coaches
          </Link>
          {coach.sample && (
            <p className="mt-4 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
              This is a made-up profile to show how coach pages look. Its contact details don&apos;t
              reach anyone.
            </p>
          )}
          <div className="mt-6 flex items-center gap-4 md:gap-6">
            <CoachAvatar name={profile.name} photoId={coach.photoId} size="lg" />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{profile.name}</h1>
              <p className="mt-1 text-muted md:text-lg">
                {profile.suburb} · {areaName(profile.area)}
              </p>
              <div className="mt-2">
                <CoachBadges pgaVerified={coach.pgaVerified} sample={coach.sample} />
              </div>
            </div>
          </div>
          <p className="mt-5 text-lg font-medium">{profile.headline}</p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Specialities">
            {profile.specialities.map((s) => (
              <li key={s} className="rounded-full bg-surface px-3 py-1.5 text-sm">
                {specialityName(s)}
              </li>
            ))}
          </ul>
          <p className="mt-5 whitespace-pre-line">{profile.bio}</p>

          <section aria-labelledby="when" className="mt-8">
            <h2 id="when" className="text-xl font-semibold">
              When {first} teaches
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { label: "This week", dates: weekDates(today, "this"), free: weeks.thisWeek },
                  { label: "Next week", dates: weekDates(today, "next"), free: weeks.nextWeek },
                ] as const
              ).map((w) => (
                <div key={w.label} className="rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold">{w.label}</h3>
                  <ul className="mt-2 grid grid-cols-7 gap-1">
                    {w.dates.map((d) => {
                      const teaching = w.free.includes(d);
                      return (
                        <li
                          key={d}
                          title={formatPerthDay(d)}
                          className={`flex flex-col items-center rounded-lg py-1.5 text-xs ${
                            teaching
                              ? "bg-brand font-semibold text-brand-foreground"
                              : "bg-surface text-muted"
                          }`}
                        >
                          <span>{dayLabel(d)}</span>
                          <span>{Number(d.slice(8))}</span>
                          <span className="sr-only">{teaching ? "teaching" : "not teaching"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <ul className="mt-4 rounded-xl border border-border">
              {WEEKDAYS.map((label, i) => {
                const blocks = profile.hours.filter((h) => h.day === i + 1);
                return (
                  <li
                    key={label}
                    className="flex justify-between gap-3 border-t border-border px-4 py-2.5 text-sm first:border-t-0"
                  >
                    <span className="font-medium">{label}</span>
                    <span className={blocks.length ? "" : "text-muted"}>
                      {blocks.length
                        ? blocks
                            .map((b) => `${clockLabel(b.from)} to ${clockLabel(b.to)}`)
                            .join(", ")
                        : "Not teaching"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {awayAhead.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                Away{" "}
                {awayAhead
                  .map((a) =>
                    a.from === a.to
                      ? formatPerthDay(a.from)
                      : `${formatPerthDay(a.from)} to ${formatPerthDay(a.to)}`,
                  )
                  .join(", ")}
                .
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              These are {first}&apos;s usual teaching hours.{" "}
              {bookable ? "Book and pay to pick a time." : `Message ${first} to book a time.`}
            </p>
          </section>

          {sessions.length > 0 && (
            <section aria-labelledby="sessions" className="mt-8">
              <h2 id="sessions" className="text-xl font-semibold">
                Group sessions
              </h2>
              <p className="mt-1 text-sm text-muted">
                Book a spot, or a few for friends or family. Price is per spot.
              </p>
              <GroupSessionList sessions={sessions.map((s) => ({ ...s, coachSlug: coach.slug }))} />
            </section>
          )}

          {profile.rates.length > 0 && (
            <section aria-labelledby="rates" className="mt-8">
              <h2 id="rates" className="text-xl font-semibold">
                Lessons and rates
              </h2>
              <ul className="mt-3 rounded-xl border border-border">
                {profile.rates.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <span>
                      <span className="font-medium">{r.name}</span>
                      {lessonKindName(r.kind) && lessonKindName(r.kind) !== r.name && (
                        <span className="ml-2 inline-block rounded-full bg-surface px-2 py-0.5 align-middle text-xs font-medium text-muted">
                          {lessonKindName(r.kind)}
                        </span>
                      )}
                      <span className="block text-sm text-muted">
                        {r.minutes} min · {PEOPLE[r.people]}
                      </span>
                      {lessonWhere(r) && (
                        <span className="block text-sm text-muted">{lessonWhere(r)}</span>
                      )}
                      {hasSpecialRates(r) && (
                        <span className="block text-sm text-muted">{specialRatesLine(r)}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatPrice(r.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="where" className="mt-8">
            <h2 id="where" className="text-xl font-semibold">
              Where {first} teaches
            </h2>
            <ul className="mt-3 rounded-xl border border-border">
              {profile.travel && (
                <li className="border-t border-border px-4 py-3 first:border-t-0">
                  <span className="font-medium">Comes to you</span>
                  <span className="block text-sm text-muted">
                    {[
                      `Anywhere you choose in ${listNames(profile.travel.areas.map(areaName))}`,
                      profile.travel.note,
                    ]
                      .filter(Boolean)
                      .join(". ")}
                  </span>
                </li>
              )}
              {places.map((p, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  {p.course ? (
                    <Link href={`/courses/${p.course.slug}`} className="font-medium text-brand">
                      {p.course.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{p.name}</span>
                  )}
                  <span className="text-sm text-muted">{p.course?.suburb ?? p.suburb}</span>
                </li>
              ))}
            </ul>
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand"
              >
                Directions
              </a>
            )}
          </section>
        </div>

        <aside aria-labelledby="book" className="mt-8 md:mt-10">
          <div className="flex flex-col gap-3 rounded-xl border border-border p-5 md:sticky md:top-[calc(var(--header-height)+1.5rem)]">
            <h2 id="book" className="text-lg font-semibold">
              Book a lesson
            </h2>
            {bookable && (
              <>
                <Link href={`/coaches/${coach.slug}/book`} className={primaryButton}>
                  Book and pay
                </Link>
                <p className="-mt-1 text-sm text-muted">
                  Pick a time and pay securely. Your card is only charged once {first} accepts.
                </p>
              </>
            )}
            {contact.whatsapp && (
              <ContactLink
                slug={coach.slug}
                method="whatsapp"
                href={whatsappLink(contact.whatsapp, message)}
                label="Message on WhatsApp"
                primary={!bookable}
                external
              />
            )}
            {contact.email && (
              <ContactLink
                slug={coach.slug}
                method="email"
                href={emailLink(contact.email, "Golf lesson (found you on BookOn)", message)}
                label="Email"
                primary={!bookable && !contact.whatsapp}
              />
            )}
            {contact.phone && (
              <ContactLink
                slug={coach.slug}
                method="phone"
                href={`tel:${contact.phone}`}
                label={`Call ${formatAuPhone(contact.phone)}`}
              />
            )}
            {contact.website && (
              <ContactLink
                slug={coach.slug}
                method="website"
                href={contact.website}
                label="Website"
                external
              />
            )}
            {!bookable && (
              <p className="text-sm text-muted">
                You book and pay with {first}. Say you found them on BookOn.
              </p>
            )}
          </div>
        </aside>
      </main>
    </>
  );
}

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
