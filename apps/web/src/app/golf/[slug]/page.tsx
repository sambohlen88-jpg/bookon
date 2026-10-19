import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPerthDays,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  isoWeekday,
  perthDate,
  specialityName,
} from "@bookon/core";
import {
  listCourseDetails,
  listLiveCoaches,
  nextTeeTimes,
  searchTeeTimes,
  type CourseDetails,
  type CourseResult,
  type ResultTeeTime,
} from "@bookon/db";
import { siteUrl } from "@bookon/email";
import { CoachAvatar } from "@/components/coach-avatar";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";
import { bookLink } from "@/lib/click-token";
import { directoryCoach } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { LATEST_BAY_TIME, defaultForm, searchHref } from "@/lib/search-form";
import { SEO_PAGES, seoPage } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = seoPage((await params).slug);
  if (!page) return { title: "Not found · BookOn" };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/golf/${page.slug}` },
    openGraph: { title: page.h1, description: page.description, type: "website" },
  };
}

/** One course or venue on the page, with a few of its next free times. */
interface Listing {
  course: CourseResult["course"];
  times: ResultTeeTime[];
  /** e.g. "12 free on Sat, 8 on Sun", instead of times. */
  summary?: string;
}

const MAX_LISTED = 12;

export default async function SeoLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = seoPage((await params).slug);
  if (!page) notFound();
  const now = new Date();
  const today = perthDate(now);
  const db = getDb();
  // One after another: the local database takes one query at a time.
  const all = await listCourseDetails(db);
  const golf = all.filter((c) => c.kind === "course");
  const search = (
    from: string,
    to: string,
    extra: Partial<Parameters<typeof searchTeeTimes>[1]> = {},
  ) =>
    searchTeeTimes(
      db,
      {
        dateFrom: from,
        dateTo: to,
        timeFrom: "05:00",
        timeTo: "20:00",
        players: 1,
        holes: null,
        courseSlugs: null,
        ...extra,
      },
      now,
    );
  const firstThree = (results: CourseResult[]): Listing[] =>
    results
      .filter((r) => r.teeTimes.length > 0)
      .map((r) => ({ course: r.course, times: r.teeTimes.slice(0, 3) }))
      .sort((a, b) => a.times[0]!.startTime.getTime() - b.times[0]!.startTime.getTime());

  let listings: Listing[] = [];
  let venues: Listing[] = [];
  let coaches: ReturnType<typeof directoryCoach>[] = [];
  let quiet: CourseDetails[] = [];
  let searchLink = searchHref({ ...defaultForm(now), date: today });

  switch (page!.kind) {
    case "area": {
      const area = page!.area;
      const inArea = golf.filter((c) => c.area === area);
      const results = await nextTeeTimes(db, now, {
        players: 1,
        courseSlugs: inArea.map((c) => c.slug),
      });
      listings = firstThree(results);
      quiet = inArea.filter((c) => !listings.some((l) => l.course.id === c.id));
      const nearbyVenues = all.filter((c) => c.kind !== "course" && c.area === area);
      if (nearbyVenues.length > 0)
        venues = firstThree(
          await nextTeeTimes(db, now, {
            players: 1,
            play: "bays",
            courseSlugs: nearbyVenues.map((c) => c.slug),
          }),
        );
      coaches = (await listLiveCoaches(db))
        .filter((c) => c.profile.area === area)
        .map((c) => directoryCoach(c, now));
      searchLink = searchHref({ ...defaultForm(now), date: today, area });
      break;
    }
    case "today": {
      listings = firstThree(await nextTeeTimes(db, now, { players: 1, days: 1 }));
      break;
    }
    case "weekend": {
      const dow = isoWeekday(today);
      const saturday = dow === 7 ? today : addPerthDays(today, 6 - dow);
      const sunday = dow === 7 ? today : addPerthDays(saturday, 1);
      const result = await search(saturday, sunday);
      listings = result.courses
        .filter((r) => r.teeTimes.length > 0)
        .map((r) => {
          const sat = r.teeTimes.filter((t) => t.playDate === saturday).length;
          const sun = r.teeTimes.filter((t) => t.playDate === sunday).length;
          const parts = [
            sat && saturday !== sunday ? `${sat} on ${formatPerthDay(saturday)}` : null,
            sun ? `${sun} on ${formatPerthDay(sunday)}` : null,
          ].filter(Boolean);
          return { course: r.course, times: [], summary: `${parts.join(", ")} free` };
        })
        .sort((a, b) => a.course.name.localeCompare(b.course.name));
      searchLink = searchHref({
        ...defaultForm(now),
        date: saturday,
        days: saturday === sunday ? 1 : 3,
      });
      break;
    }
    case "twilight": {
      listings = firstThree(
        (await search(today, addPerthDays(today, 1), { timeFrom: "15:00" })).courses,
      );
      searchLink = searchHref({ ...defaultForm(now), date: today, days: 3, from: "15:00" });
      break;
    }
    case "nine": {
      listings = firstThree((await search(today, addPerthDays(today, 1), { holes: 9 })).courses);
      searchLink = searchHref({ ...defaultForm(now), date: today, days: 3, holes: "9" });
      break;
    }
    case "cheap": {
      const result = await search(today, addPerthDays(today, 1));
      listings = result.courses
        .map((r) => {
          const priced = r.teeTimes.filter((t) => t.priceCents !== null);
          const cheapest = Math.min(...priced.map((t) => t.priceCents!));
          return {
            course: r.course,
            times: priced.filter((t) => t.priceCents === cheapest).slice(0, 3),
          };
        })
        .filter((l) => l.times.length > 0)
        .sort((a, b) => a.times[0]!.priceCents! - b.times[0]!.priceCents!);
      break;
    }
    case "sims": {
      venues = firstThree(await nextTeeTimes(db, now, { players: 1, play: "bays" }));
      quiet = all.filter((c) => c.kind !== "course" && !venues.some((v) => v.course.id === c.id));
      searchLink = searchHref({
        ...defaultForm(now),
        play: "bays",
        date: today,
        to: LATEST_BAY_TIME,
      });
      break;
    }
    case "lessons": {
      coaches = (await listLiveCoaches(db)).map((c) => directoryCoach(c, now));
      searchLink = "/coaches";
      break;
    }
  }

  const area = page!.kind === "area" ? page! : null;
  const areaCourses = area ? golf.filter((c) => c.area === area.area) : [];
  const faqs = area
    ? [
        {
          q: `Which public golf courses are in ${area.place}?`,
          a: areaCourses.length
            ? `BookOn checks ${areaCourses.length} public ${areaCourses.length === 1 ? "course" : "courses"} here: ${areaCourses.map((c) => c.name).join(", ")}.`
            : "BookOn doesn't check any public courses here yet.",
        },
        {
          q: "How do I book a tee time?",
          a: "Pick a time and tap Book. You finish booking and pay on the club's own booking page, so the booking is with the club. BookOn is free for golfers.",
        },
        {
          q: "How up to date are the times?",
          a: "BookOn checks each club's booking page through the day and only shows times checked in the last 90 minutes, so they're very likely still free.",
        },
      ]
    : [];
  const site = siteUrl();
  const pageUrl = `${site}/golf/${page!.slug}`;
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "BookOn", item: `${site}/` },
        { "@type": "ListItem", position: 2, name: "Golf in Perth", item: `${site}/golf` },
        { "@type": "ListItem", position: 3, name: page!.h1, item: pageUrl },
      ],
    },
    ...(listings.length || venues.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: [...listings, ...venues].map((l, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: l.course.name,
              url: `${site}/courses/${l.course.slug}`,
            })),
          },
        ]
      : []),
    ...(faqs.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}
      />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:max-w-4xl md:px-6 md:pt-12">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/golf" className="text-brand">
            Golf in Perth
          </Link>
        </nav>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{page!.h1}</h1>
        <p className="mt-3 max-w-2xl text-muted md:text-lg">{page!.intro}</p>
        {area && <p className="mt-2 text-sm text-muted">Including courses near {area.suburbs}.</p>}
        <Link href={searchLink} className={`${primaryButton} mt-6`}>
          {page!.kind === "lessons"
            ? "Find a coach"
            : page!.kind === "sims"
              ? "Find a bay"
              : "Search every time"}
        </Link>

        {page!.kind !== "sims" && page!.kind !== "lessons" && (
          <section aria-labelledby="courses" className="mt-10">
            <h2 id="courses" className="text-xl font-semibold">
              {page!.kind === "weekend"
                ? "Free this weekend"
                : page!.kind === "cheap"
                  ? "Lowest green fee at each course"
                  : "Next free tee times"}
            </h2>
            {listings.length === 0 ? (
              <p className="mt-3 rounded-xl border border-border px-4 py-3 text-sm text-muted">
                Nothing free right now, or we haven&apos;t checked recently.{" "}
                <Link href={searchLink} className="text-brand underline">
                  Search the latest times
                </Link>
                .
              </p>
            ) : (
              <CourseList listings={listings.slice(0, MAX_LISTED)} today={today} />
            )}
            {quiet.length > 0 && page!.kind === "area" && (
              <p className="mt-3 text-sm text-muted">
                Also here:{" "}
                {quiet.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ", "}
                    <Link href={`/courses/${c.slug}`} className="text-brand">
                      {c.name}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </section>
        )}

        {(venues.length > 0 || page!.kind === "sims") && (
          <section aria-labelledby="venues" className="mt-10">
            <h2 id="venues" className="text-xl font-semibold">
              Golf simulators and ranges{area ? " nearby" : ""}
            </h2>
            {venues.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No bays free right now.</p>
            ) : (
              <CourseList listings={venues} today={today} />
            )}
            {quiet.length > 0 && page!.kind === "sims" && (
              <p className="mt-3 text-sm text-muted">
                Also:{" "}
                {quiet.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ", "}
                    <Link href={`/courses/${c.slug}`} className="text-brand">
                      {c.name}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </section>
        )}

        {coaches.length > 0 && (
          <section aria-labelledby="coaches" className="mt-10">
            <h2 id="coaches" className="text-xl font-semibold">
              Golf coaches{area ? " nearby" : ""}
            </h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {coaches.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/coaches/${c.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-brand"
                  >
                    <CoachAvatar name={c.name} photoId={c.photoId} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-sm text-muted">
                        {c.suburb} · {c.specialities.slice(0, 2).map(specialityName).join(", ")}
                        {c.from ? ` · ${c.from}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {faqs.length > 0 && (
          <section aria-labelledby="faq" className="mt-10">
            <h2 id="faq" className="text-xl font-semibold">
              Questions
            </h2>
            <dl className="mt-3 flex flex-col gap-4">
              {faqs.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="mt-1 text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="more" className="mt-12 border-t border-border pt-6">
          <h2 id="more" className="text-lg font-semibold">
            More golf in Perth
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SEO_PAGES.filter((p) => p.slug !== page!.slug).map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/golf/${p.slug}`}
                  className="flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-brand"
                >
                  {p.h1}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted">
            Times and prices come from each club&apos;s booking page and can change. You book and
            pay with the club.
          </p>
        </section>
      </main>
    </>
  );
}

function CourseList({ listings, today }: { listings: Listing[]; today: string }) {
  return (
    <ul className="mt-3 overflow-hidden rounded-xl border border-border">
      {listings.map((l) => (
        <li key={l.course.id} className="border-t border-border px-4 py-3 first:border-t-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/courses/${l.course.slug}`} className="font-semibold hover:text-brand">
              {l.course.name}
            </Link>
            <span className="text-sm text-muted">{l.course.suburb}</span>
          </div>
          {l.summary ? (
            <p className="mt-1 text-sm text-brand">{l.summary}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {l.times.map((t, i) => (
                <li key={`${t.startTime.toISOString()}-${i}`}>
                  <a
                    href={bookLink({
                      courseId: l.course.id,
                      startTime: t.startTime.toISOString(),
                      url: t.bookingUrl,
                      source: "directory",
                    })}
                    target="_blank"
                    rel="noopener"
                    className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:border-brand"
                  >
                    <span className="font-semibold">{formatPerthTime(t.startTime)}</span>
                    <span className="text-muted">
                      {t.playDate === today ? "today" : formatPerthDay(t.playDate)}
                      {t.bays
                        ? ` · ${t.bays.length} ${t.bays.length === 1 ? "bay" : "bays"}`
                        : ` · ${t.holes} holes`}
                      {t.priceCents !== null && !t.bays ? ` · ${formatPrice(t.priceCents)}` : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
