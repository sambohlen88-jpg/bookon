import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPerthDays,
  areaName,
  distanceKm,
  formatDistance,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
  perthToUtc,
  summariseWeather,
  weatherEmoji,
  weatherWords,
} from "@bookon/core";
import {
  FACILITIES,
  approvedCoursePhotos,
  courseDetails,
  coursePublicInfo,
  forecastFor,
  listCourseDetails,
  listFavourites,
  nextTeeTimes,
  searchTeeTimes,
  type ClubRate,
  type CourseDetails,
} from "@bookon/db";
import { describeRate } from "@bookon/email";
import { createAlertFromSearch } from "@/app/actions";
import { CourseArt } from "@/components/course-art";
import { FavouriteStar } from "@/components/results";
import { ShareButton } from "@/components/share-button";
import { SiteHeader } from "@/components/site-header";
import { primaryButton, secondaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { bookLink } from "@/lib/click-token";
import { getDb } from "@/lib/db";
import { PROBLEM_LABEL } from "@/lib/check-problems";
import { shortCourseName } from "@/lib/course-info";
import { RATE_CATEGORIES } from "@/lib/rate-labels";
import { SEO_PAGES } from "@/lib/seo-pages";
import {
  DEFAULT_SESSION,
  EARLIEST_TIME,
  kindPlays,
  latestTime,
  searchHref,
  type PlayChoice,
} from "@/lib/search-form";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 7;
const NEXT_SHOWN = 6;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const course = await courseDetails(getDb(), (await params).slug);
  if (!course) return { title: "Course not found · BookOn" };
  if (course.kind !== "course")
    return {
      title: `${course.name} free bays · BookOn`,
      description: `Free ${KIND_NAME[course.kind].toLowerCase()} bays at ${course.name}, ${course.suburb}, for the next ${DAYS_SHOWN} days. Book with the venue.`,
    };
  return {
    title: `${course.name} tee times · BookOn`,
    description: `Free tee times at ${course.name}, ${course.suburb}, for the next ${DAYS_SHOWN} days. Book with the club.`,
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const course = await courseDetails(db, (await params).slug);
  if (!course) notFound();
  const now = new Date();
  const today = perthDate(now);
  // A golf simulator or driving range: bays booked by the hour rather than tee times.
  const venue = course.kind !== "course";
  const play: PlayChoice = venue ? "bays" : "golf";
  // One after another: the local database takes one query at a time.
  const days = await upcomingDays(db, course, now);
  const photoId = (await approvedCoursePhotos(db)).get(course.id) ?? null;
  const next = (
    await nextTeeTimes(db, now, {
      players: 2,
      courseSlugs: [course.slug],
      play: venue ? "bays" : "golf",
    })
  )[0];
  const { profile, rates } = await coursePublicInfo(db, course.id, today);
  const forecast = await forecastFor(db, course.id);
  const nearby = nearbyCourses(course, await listCourseDetails(db));
  const user = await currentUser();
  const starred = user ? (await listFavourites(db, user.id)).some((f) => f.id === course.id) : null;

  const form = (date: string, extra: { days?: number } = {}) => ({
    play,
    date,
    days: extra.days ?? 1,
    from: EARLIEST_TIME,
    to: latestTime(play),
    players: 2,
    holes: "any" as const,
    minutes: DEFAULT_SESSION,
    courses: [course.slug],
    area: null,
  });
  const weekSearch = searchHref(form(today, { days: 7 }));
  const clubLink = bookLink({
    courseId: course.id,
    startTime: null,
    url: course.bookingUrl,
    source: "directory",
  });
  const club = profile.club;
  const address = club?.street
    ? `${club.street}, ${club.suburb} ${club.state ?? "WA"} ${club.postcode ?? ""}`.trim()
    : null;
  const directions =
    course.latitude !== null && course.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${course.latitude},${course.longitude}`
      : address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${course.name}, ${address}`)}`
        : null;
  const facilities = profile.extras?.facilities ?? [];
  // Simulators are indoors, so no weather.
  const dayWeather = (date: string) =>
    forecast && course.kind !== "simulator"
      ? summariseWeather(forecast.hours, perthToUtc(date, "06:00"), perthToUtc(date, "18:00"))
      : null;
  const upcoming = (next?.teeTimes ?? []).slice(0, NEXT_SHOWN);
  const areaPage = SEO_PAGES.find((p) => p.kind === "area" && p.area === course.area) as
    Extract<(typeof SEO_PAGES)[number], { kind: "area" }> | undefined;

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        // Lets search engines show the course and its suburb.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": venue ? "SportsActivityLocation" : "GolfCourse",
            name: course.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: course.suburb,
              addressRegion: "WA",
              addressCountry: "AU",
            },
            url: course.websiteUrl,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <main className="pb-12">
        <div className="relative">
          <CourseArt
            slug={course.slug}
            photoId={photoId}
            wide
            eager
            className="h-44 w-full md:h-80"
          />
          {!photoId && (
            <span className="absolute bottom-2 right-3 rounded bg-background/80 px-2 py-0.5 text-xs text-muted">
              Illustration
            </span>
          )}
        </div>
        <div className="mx-auto max-w-md px-4 md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_360px] md:gap-12 md:px-6">
          <div className="min-w-0">
            <div className="mt-6 flex items-start justify-between gap-3 md:mt-10">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{course.name}</h1>
                <p className="mt-2 text-muted md:text-lg">
                  {course.suburb} · {areaName(course.area)} ·{" "}
                  {venue ? KIND_NAME[course.kind] : `${course.holes} holes`}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-1">
                {!venue && (
                  <ShareButton query={weekSearch} course={course.slug} courseName={course.name} />
                )}
                <FavouriteStar
                  courseId={course.id}
                  name={course.name}
                  on={starred}
                  back={`/courses/${course.slug}`}
                />
              </div>
            </div>

            {profile.extras?.description && (
              <p className="mt-4 whitespace-pre-line">{profile.extras.description}</p>
            )}

            <section aria-labelledby="next" className="mt-8">
              <h2 id="next" className="text-xl font-semibold">
                {venue ? "Next free bays" : "Next free times"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Today and tomorrow, for 2 players{venue ? ", for an hour or more" : ""}.
              </p>
              {upcoming.length === 0 ? (
                <p className="mt-3 rounded-xl border border-border px-4 py-3 text-sm text-muted">
                  {venue
                    ? "Nothing free today or tomorrow. Check the week below."
                    : "Nothing free today or tomorrow. Check the week below, or set an alert."}
                </p>
              ) : (
                <ul className="tee-list mt-3 rounded-xl border border-border px-4">
                  {upcoming.map((t, i) => (
                    // Two tees can start at the same minute, so the position keeps keys apart.
                    <li key={`${t.startTime.toISOString()}-${t.holes}-${i}`} className="tee-row">
                      <span className="tee-time">{formatPerthTime(t.startTime)}</span>
                      <span className="tee-info">
                        <span>
                          {t.playDate === today ? "Today" : "Tomorrow"} ·{" "}
                          {t.bays
                            ? `${t.bays.length} ${t.bays.length === 1 ? "bay" : "bays"} free`
                            : `${t.holes} holes`}
                        </span>
                        <span className="text-muted">
                          {t.bays
                            ? `Up to ${t.spotsAvailable} players · ${t.priceCents === null ? "Price at venue" : `${formatPrice(t.priceCents)} an hour`}`
                            : `${t.spotsAvailable} ${t.spotsAvailable === 1 ? "spot" : "spots"} · ${t.priceCents === null ? "Price at club" : formatPrice(t.priceCents)}`}
                        </span>
                      </span>
                      <a
                        href={bookLink({
                          courseId: course.id,
                          startTime: t.startTime.toISOString(),
                          url: t.bookingUrl,
                          source: "directory",
                        })}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Book ${formatPerthTime(t.startTime)} at ${course.name} (opens the ${venue ? "venue" : "club"}'s site)`}
                        className="tee-book"
                      >
                        Book
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="week" className="mt-8">
              <h2 id="week" className="text-xl font-semibold">
                This week
              </h2>
              <p className="mt-1 text-sm text-muted">
                {venue ? "Start times with a bay free for an hour" : "Free times"} for 2 players,
                any time of day
                {forecast && course.kind !== "simulator" ? ", with the daytime weather" : ""}.
              </p>
              <ul className="mt-4 rounded-xl border border-border">
                {days.map((d) => {
                  const w = dayWeather(d.date);
                  return (
                    <li
                      key={d.date}
                      className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2 first:border-t-0"
                    >
                      <span>
                        <span className="font-medium">{formatPerthDay(d.date)}</span>
                        {w && (
                          <span className="block text-sm text-muted">
                            <span role="img" aria-label={weatherWords(w.symbol)}>
                              {weatherEmoji(w.symbol)}
                            </span>{" "}
                            {w.temperature}°
                            {w.rainChance !== null
                              ? w.rainChance >= 20
                                ? ` · ${w.rainChance}% rain`
                                : ""
                              : w.rainMm >= 0.5
                                ? ` · ${w.rainMm} mm rain`
                                : ""}
                          </span>
                        )}
                      </span>
                      {d.status === "times" ? (
                        <Link
                          href={searchHref(form(d.date))}
                          prefetch={false}
                          className="text-sm font-semibold text-brand hover:underline"
                        >
                          {d.count} {d.count === 1 ? "time" : "times"}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted">
                          {d.problem ?? DAY_STATUS[d.status]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {forecast && course.kind !== "simulator" && (
                <p className="mt-2 text-xs text-muted">
                  Weather from{" "}
                  <a href="https://www.met.no/en" className="underline">
                    MET Norway
                  </a>
                  , 6 am to 6 pm.
                </p>
              )}
            </section>

            {rates.length > 0 && <PriceList rates={rates} />}

            {facilities.length > 0 && (
              <section aria-labelledby="facilities" className="mt-8">
                <h2 id="facilities" className="text-xl font-semibold">
                  Facilities
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {facilities.map((f) => (
                    <li key={f} className="rounded-full bg-surface px-3 py-1.5 text-sm">
                      {FACILITIES[f]}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(profile.teeTimes?.dressCode || profile.teeTimes?.cancellationPolicy) && (
              <section aria-labelledby="good-to-know" className="mt-8">
                <h2 id="good-to-know" className="text-xl font-semibold">
                  Good to know
                </h2>
                <dl className="mt-3 flex flex-col gap-3 text-sm">
                  {profile.teeTimes?.dressCode && (
                    <div>
                      <dt className="font-medium">Dress code</dt>
                      <dd className="text-muted">{profile.teeTimes.dressCode}</dd>
                    </div>
                  )}
                  {profile.teeTimes?.cancellationPolicy && (
                    <div>
                      <dt className="font-medium">Cancellations</dt>
                      <dd className="text-muted">{profile.teeTimes.cancellationPolicy}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {nearby.length > 0 && (
              <section aria-labelledby="nearby" className="mt-8">
                <h2 id="nearby" className="text-xl font-semibold">
                  {venue ? "Sims & ranges nearby" : "Courses nearby"}
                </h2>
                <ul className="mt-3 overflow-hidden rounded-xl border border-border">
                  {nearby.map((n) => (
                    <li key={n.slug} className="border-t border-border first:border-t-0">
                      <Link
                        href={`/courses/${n.slug}`}
                        className="flex min-h-12 items-center justify-between gap-3 px-4 py-3"
                      >
                        <span className="font-medium">{shortCourseName(n.name)}</span>
                        <span className="text-sm text-muted">
                          {n.km !== null ? formatDistance(n.km) : n.suburb}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {areaPage && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/golf/${venue ? "golf-simulators-perth" : areaPage.slug}`}
                  className="font-medium text-brand"
                >
                  {venue
                    ? "All golf simulators and ranges in Perth"
                    : `More golf in ${areaPage.place}`}
                </Link>
              </p>
            )}
          </div>

          <aside className="mt-8 md:mt-10">
            <div className="flex flex-col gap-3 rounded-xl border border-border p-5 md:sticky md:top-6">
              <Link href={weekSearch} className={primaryButton}>
                {venue ? "See free bays" : "See tee times"}
              </Link>
              <a href={clubLink} target="_blank" rel="noopener" className={secondaryButton}>
                Go to the {venue ? "venue" : "club"}&apos;s booking page
              </a>
              {venue ? null : user ? (
                <form action={createAlertFromSearch}>
                  <input type="hidden" name="query" value={weekSearch.replace(/^\/search\?/, "")} />
                  <button type="submit" className={`${secondaryButton} w-full`}>
                    Tell me when a time opens up
                  </button>
                </form>
              ) : (
                <Link
                  href={`/signin?next=${encodeURIComponent(`/courses/${course.slug}`)}`}
                  className={secondaryButton}
                >
                  Sign in to set an alert
                </Link>
              )}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
                {club?.phone && (
                  <a
                    href={`tel:${club.phone.replace(/[^\d+]/g, "")}`}
                    className="min-h-11 py-3 text-brand"
                  >
                    Call {club.phone}
                  </a>
                )}
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener"
                    className="min-h-11 py-3 text-brand"
                  >
                    Directions
                  </a>
                )}
                <a
                  href={course.websiteUrl}
                  target="_blank"
                  rel="noopener"
                  className="min-h-11 py-3 text-brand"
                >
                  {venue ? "Venue website" : "Club website"}
                </a>
              </div>
              {address && <p className="text-center text-sm text-muted">{address}</p>}
              <p className="text-sm text-muted">
                {venue
                  ? `BookOn shows bays up to ${course.bookingWindowDays} days ahead. You book and pay with the venue.`
                  : `${course.name} releases tee times up to ${course.bookingWindowDays} days ahead. You book and pay with the club.`}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

/** The club's price list, grouped as golfers think about it: green fees, then extras. */
function PriceList({ rates }: { rates: ClubRate[] }) {
  const order = Object.keys(RATE_CATEGORIES) as (keyof typeof RATE_CATEGORIES)[];
  const groups = order
    .map((category) => ({ category, rates: rates.filter((r) => r.category === category) }))
    .filter((g) => g.rates.length > 0);
  return (
    <section aria-labelledby="prices" className="mt-8">
      <h2 id="prices" className="text-xl font-semibold">
        Prices
      </h2>
      <p className="mt-1 text-sm text-muted">From the club. The booking page has the final say.</p>
      {groups.map((g) => (
        <div key={g.category} className="mt-4">
          <h3 className="text-sm font-semibold">{RATE_CATEGORIES[g.category]}</h3>
          <ul className="mt-1 rounded-xl border border-border">
            {g.rates.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 border-t border-border px-4 py-2.5 text-sm first:border-t-0"
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-muted">
                    {/* The price is on the right; keep "per player" and the rest. */}
                    {describeRate(r).replace(/\$[\d,.]+ /, "")}
                  </span>
                  {r.notes && <span className="block text-muted">{r.notes}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatPrice(r.priceCents)}
                  {r.gstIncluded ? "" : " + GST"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

const KIND_NAME = {
  course: "Golf course",
  simulator: "Golf simulator",
  range: "Driving range",
} as const;

/**
 * The closest other courses, or others in the same area when locations aren't
 * known yet. Sims and ranges list other sims and ranges.
 */
function nearbyCourses(course: CourseDetails, all: CourseDetails[]) {
  const play = kindPlays(course.kind, "bays") ? "bays" : "golf";
  const others = all.filter(
    (c) => c.id !== course.id && kindPlays(c.kind, play) && c.slug !== sibling(course.slug),
  );
  const here =
    course.latitude !== null && course.longitude !== null
      ? { latitude: course.latitude, longitude: course.longitude }
      : null;
  if (here) {
    return others
      .filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => ({
        ...c,
        km: distanceKm(here, { latitude: c.latitude!, longitude: c.longitude! }),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }
  return others
    .filter((c) => course.area && c.area === course.area)
    .slice(0, 3)
    .map((c) => ({ ...c, km: null }));
}

/** OuttaBounds' simulators and range are next door to each other, so not "nearby". */
function sibling(slug: string): string | null {
  return slug.endsWith("-simulators")
    ? slug.replace(/-simulators$/, "-range")
    : slug.endsWith("-range")
      ? slug.replace(/-range$/, "-simulators")
      : null;
}

const DAY_STATUS = {
  none: "Nothing free",
  "not-open": "Not out yet",
  unknown: "Not checked yet",
} as const;

interface DaySummary {
  date: string;
  status: "times" | keyof typeof DAY_STATUS;
  count: number;
  /** Why it couldn't be checked, in words. */
  problem?: string;
}

/** How many times are free each day this week, from the latest check. */
async function upcomingDays(
  db: Parameters<typeof searchTeeTimes>[0],
  course: CourseDetails,
  now: Date,
): Promise<DaySummary[]> {
  const today = perthDate(now);
  const bays = course.kind !== "course";
  const result = await searchTeeTimes(
    db,
    {
      dateFrom: today,
      dateTo: addPerthDays(today, DAYS_SHOWN - 1),
      timeFrom: EARLIEST_TIME,
      timeTo: latestTime(bays ? "bays" : "golf"),
      players: 2,
      holes: null,
      courseSlugs: [course.slug],
      ...(bays ? { play: "bays" as const, minutes: DEFAULT_SESSION } : {}),
    },
    now,
  );
  const found = result.courses[0];
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = addPerthDays(today, i);
    const notice = found?.notices.find((n) => n.date === date);
    const count = found?.teeTimes.filter((t) => t.playDate === date).length ?? 0;
    if (notice?.kind === "not-open") return { date, status: "not-open", count };
    if (notice?.kind === "stale")
      return { date, status: "unknown", count, problem: PROBLEM_LABEL[notice.problem] };
    if (notice) return { date, status: "unknown", count };
    return { date, status: count > 0 ? "times" : "none", count };
  });
}
