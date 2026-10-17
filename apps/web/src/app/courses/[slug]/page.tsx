import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addPerthDays, formatPerthDay, perthDate } from "@bookon/core";
import { courseDetails, searchTeeTimes, type CourseDetails } from "@bookon/db";
import { CourseArt } from "@/components/course-art";
import { SiteHeader } from "@/components/site-header";
import { primaryButton, secondaryButton } from "@/components/ui";
import { bookLink } from "@/lib/click-token";
import { getDb } from "@/lib/db";
import { courseArea } from "@/lib/course-info";
import { EARLIEST_TIME, LATEST_TIME, searchHref } from "@/lib/search-form";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 7;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const course = await courseDetails(getDb(), (await params).slug);
  if (!course) return { title: "Course not found · BookOn" };
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
  const days = await upcomingDays(db, course, now);
  const form = (date: string, extra: { days?: number } = {}) => ({
    date,
    days: extra.days ?? 1,
    from: EARLIEST_TIME,
    to: LATEST_TIME,
    players: 2,
    holes: "any" as const,
    courses: [course.slug],
  });
  const clubLink = bookLink({
    courseId: course.id,
    startTime: null,
    url: course.bookingUrl,
    source: "directory",
  });

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        // Lets search engines show the course and its suburb.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "GolfCourse",
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
          <CourseArt slug={course.slug} wide eager className="h-44 w-full md:h-80" />
          <span className="absolute bottom-2 right-3 rounded bg-background/80 px-2 py-0.5 text-xs text-muted">
            Illustration
          </span>
        </div>
        <div className="mx-auto max-w-md px-4 md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_360px] md:gap-12 md:px-6">
          <div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight md:mt-10 md:text-4xl">
              {course.name}
            </h1>
            <p className="mt-2 text-muted md:text-lg">
              {course.suburb} · {courseArea(course.slug)} · {course.holes} holes
            </p>

            <section aria-labelledby="week" className="mt-8">
              <h2 id="week" className="text-xl font-semibold">
                Free times this week
              </h2>
              <p className="mt-1 text-sm text-muted">For 2 players, any time of day.</p>
              <ul className="mt-4 rounded-xl border border-border">
                {days.map((d) => (
                  <li
                    key={d.date}
                    className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2 first:border-t-0"
                  >
                    <span className="font-medium">{formatPerthDay(d.date)}</span>
                    {d.status === "times" ? (
                      <Link
                        href={searchHref(form(d.date))}
                        prefetch={false}
                        className="text-sm font-semibold text-brand hover:underline"
                      >
                        {d.count} {d.count === 1 ? "time" : "times"}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">{DAY_STATUS[d.status]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="mt-8 md:mt-10">
            <div className="flex flex-col gap-3 rounded-xl border border-border p-5 md:sticky md:top-6">
              <Link href={searchHref(form(perthDate(now), { days: 7 }))} className={primaryButton}>
                See tee times
              </Link>
              <a href={clubLink} target="_blank" rel="noopener" className={secondaryButton}>
                Go to the club&apos;s booking page
              </a>
              <a
                href={course.websiteUrl}
                target="_blank"
                rel="noopener"
                className="text-center text-sm text-brand hover:underline"
              >
                Club website
              </a>
              <p className="text-sm text-muted">
                {course.name} releases tee times up to {course.bookingWindowDays} days ahead. You
                book and pay with the club.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

const DAY_STATUS = {
  none: "Nothing free",
  "not-open": "Not out yet",
  unknown: "Couldn't check",
} as const;

interface DaySummary {
  date: string;
  status: "times" | keyof typeof DAY_STATUS;
  count: number;
}

/** How many times are free each day this week, from the latest check. */
async function upcomingDays(
  db: Parameters<typeof searchTeeTimes>[0],
  course: CourseDetails,
  now: Date,
): Promise<DaySummary[]> {
  const today = perthDate(now);
  const result = await searchTeeTimes(
    db,
    {
      dateFrom: today,
      dateTo: addPerthDays(today, DAYS_SHOWN - 1),
      timeFrom: EARLIEST_TIME,
      timeTo: LATEST_TIME,
      players: 2,
      holes: null,
      courseSlugs: [course.slug],
    },
    now,
  );
  const found = result.courses[0];
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = addPerthDays(today, i);
    const notice = found?.notices.find((n) => n.date === date);
    const count = found?.teeTimes.filter((t) => t.playDate === date).length ?? 0;
    if (notice?.kind === "not-open") return { date, status: "not-open", count };
    if (notice) return { date, status: "unknown", count };
    return { date, status: count > 0 ? "times" : "none", count };
  });
}
