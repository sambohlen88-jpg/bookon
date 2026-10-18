import Link from "next/link";
import { formatPerthTime, perthDate, type VenueKind } from "@bookon/core";
import {
  approvedCoursePhotos,
  listCourseDetails,
  listFavourites,
  nextTeeTimes,
  type CourseDetails,
  type CourseResult,
} from "@bookon/db";
import { CourseArt } from "@/components/course-art";
import { CourseCard } from "@/components/course-card";
import { FreeSoon } from "@/components/free-soon";
import { RecentSearches } from "@/components/recent-searches";
import { SearchForm } from "@/components/search-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shortCourseName } from "@/lib/course-info";
import { LATEST_BAY_TIME, defaultForm, searchHref } from "@/lib/search-form";

export const dynamic = "force-dynamic";

/** Shown first in the desktop gallery: a spread of Perth courses. */
const FEATURED = [
  "collier-park",
  "the-cut",
  "point-walter",
  "joondalup-resort",
  "secret-harbour",
  "whaleback",
  "maylands",
  "kennedy-bay",
];

export default async function Home() {
  const now = new Date();
  // The form must still show if the database is down; search will explain.
  const all: CourseDetails[] = await listCourseDetails(getDb()).catch(() => []);
  // Golf courses for the counts and lists; the search also offers sims and ranges.
  const courses = all.filter((c) => c.kind === "course");
  const venues = all.length - courses.length;
  const photos = await approvedCoursePhotos(getDb()).catch(() => new Map<string, string>());
  const featured = FEATURED.map((slug) => courses.find((c) => c.slug === slug)).filter(
    (c): c is CourseDetails => Boolean(c),
  );
  const longestWindow = Math.max(7, ...courses.map((c) => c.bookingWindowDays));
  const user = await currentUser();
  const favourites = user ? await listFavourites(getDb(), user.id) : [];
  // One query for Free soon and My courses. Kept one after another for the local database.
  const upcoming: CourseResult[] = await nextTeeTimes(getDb(), now, {
    players: 2,
    play: "all",
  }).catch(() => []);
  const upcomingGolf = upcoming.filter((u) => u.course.kind === "course");
  const today = perthDate(now);
  const seeAll = searchHref({ ...defaultForm(now), date: today });

  return (
    <>
      <SiteHeader />

      {/* Phones: straight to the search, as before. */}
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 lg:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Find a tee time</h1>
        <p className="mt-2 text-muted">Every Perth public course we check, in one search.</p>
        <div className="mt-6">
          <SearchForm values={defaultForm(now)} courses={all} now={now} />
        </div>
        <RecentSearches today={today} />
        {favourites.length > 0 && (
          <MyCourses
            courses={favourites.map((f) => ({
              ...f,
              result: upcoming.find((u) => u.course.id === f.id),
            }))}
            today={today}
            now={now}
          />
        )}
        <div className="mt-10">
          <FreeSoon results={upcomingGolf} now={now} players={2} seeAll={seeAll} />
        </div>
        <section aria-labelledby="how" className="mt-10">
          <h2 id="how" className="text-lg font-semibold">
            How BookOn works
          </h2>
          <ol className="mt-3 flex flex-col gap-4">
            <Step n={1} title="Search every course at once">
              Pick a day, a time and how many are playing.
            </Step>
            <Step n={2} title="Pick your time">
              Times, holes, spots and prices side by side.
            </Step>
            <Step n={3} title="Book with the club">
              Tap Book and finish on the club&apos;s own page. You pay the club, never us.
            </Step>
          </ol>
        </section>
        {courses.length > 0 && (
          <details className="mt-8 text-sm text-muted">
            <summary className="min-h-11 cursor-pointer py-3">
              Checking {courses.length} courses across Perth and WA
            </summary>
            <ul className="columns-2 gap-4">
              {courses.map((c) => (
                <li key={c.slug} className="py-0.5">
                  {shortCourseName(c.name)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>

      {/* Desktop: a full website. */}
      <main className="hidden lg:block">
        <section className="relative overflow-hidden bg-hero-bg text-hero-fg">
          <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_520px] items-start gap-12 px-6 pb-40 pt-16">
            {/* Pinned to the top, so opening the course list doesn't move it. */}
            <div className="pt-10">
              <p className="flex items-center gap-4 text-5xl font-bold tracking-tight">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon.svg" alt="" width={72} height={72} className="size-18" />
                BookOn
              </p>
              <h1 className="mt-8 text-5xl font-bold leading-tight tracking-tight">
                Every Perth public tee time, in one search.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-hero-muted">
                {courses.length} courses across Perth and WA
                {venues > 0 ? `, plus ${venues} golf sims and ranges,` : ""} checked through the
                day. Find a time that suits, then book with the club. Free for golfers.
              </p>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6">
                <Stat value={String(courses.length)} label="courses" />
                <Stat value={`${longestWindow} days`} label="ahead" />
                <Stat value="$0" label="booking fees" />
              </dl>
            </div>
            <div className="rounded-2xl bg-background p-6 text-foreground shadow-2xl">
              <h2 className="mb-5 text-2xl font-bold tracking-tight">Find a tee time</h2>
              <SearchForm values={defaultForm(now)} courses={all} now={now} idPrefix="d-" />
            </div>
          </div>
          <CourseArt
            slug="bookon-home"
            wide
            eager
            className="absolute inset-x-0 bottom-0 h-56 w-full"
          />
        </section>

        {upcoming.some((u) => u.teeTimes.length > 0) && (
          <section className="mx-auto max-w-6xl px-6 pt-20">
            <FreeSoon results={upcoming} now={now} players={2} seeAll={seeAll} limit={8} />
          </section>
        )}

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-8 grid grid-cols-3 gap-8">
            <Step n={1} title="Search every course at once">
              Pick a day, a time and how many are playing. We show what&apos;s free at every course
              we check.
            </Step>
            <Step n={2} title="Pick your time">
              See times, holes, spots and prices side by side, with how recently each club was
              checked.
            </Step>
            <Step n={3} title="Book with the club">
              Tap Book and finish on the club&apos;s own booking page. You pay the club, never us.
            </Step>
          </ol>
        </section>

        {featured.length > 0 && (
          <section className="bg-surface py-20">
            <div className="mx-auto max-w-6xl px-6">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Courses we check</h2>
                  <p className="mt-2 text-muted">
                    Public courses from Perth to Broome, Albany and Margaret River.
                  </p>
                </div>
                <Link href="/courses" className="font-semibold text-brand hover:underline">
                  See all {courses.length} courses
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-4 gap-6">
                {featured.map((c) => (
                  <CourseCard key={c.slug} course={c} photoId={photos.get(c.id)} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-16 px-6 py-20">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Never miss a cancellation</h2>
            <p className="mt-4 text-lg text-muted">
              Nothing free when you want to play? Set an alert from any search. When a time opens
              up, we&apos;ll tell you straight away.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              <Tick>By email, or a notification on your phone</Tick>
              <Tick>Only new times, and never the same one twice</Tick>
              <Tick>Pause or stop any time, from any email</Tick>
            </ul>
            <Link
              href="/signin"
              className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-brand px-5 font-semibold text-brand-foreground"
            >
              Create a free account
            </Link>
          </div>
          <div className="flex flex-col gap-4" aria-hidden="true">
            <SampleNotification
              title="New tee time: Collier Park Golf Course"
              body="Sat 7:30 am · 18 holes · 4 spots · $40"
              when="now"
            />
            <SampleNotification
              title="3 new tee times"
              body="The Cut Golf Course, from Sun 6:48 am"
              when="1 hr ago"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block text-3xl font-bold">{value}</span>
        <span className="text-sm text-hero-muted">{label}</span>
      </dd>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-border p-4 lg:p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
        {n}
      </span>
      <h3 className="mt-3 text-lg font-semibold lg:mt-4">{title}</h3>
      <p className="mt-2 text-muted">{children}</p>
    </li>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="font-bold text-brand">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/** A drawing of a phone notification, to show what an alert looks like. */
function SampleNotification({ title, body, when }: { title: string; body: string; when: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="flex justify-between gap-3 text-xs text-muted">
          <span>BookOn</span>
          <span>{when}</span>
        </p>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

/** The golfer's starred courses, each with its next free time. */
function MyCourses({
  courses,
  today,
  now,
}: {
  courses: { id: string; slug: string; name: string; kind: VenueKind; result?: CourseResult }[];
  today: string;
  now: Date;
}) {
  return (
    <section aria-labelledby="my-courses" className="mt-10">
      <h2 id="my-courses" className="text-lg font-semibold">
        My courses
      </h2>
      <ul className="mt-2 overflow-hidden rounded-xl border border-border">
        {courses.map((c) => {
          const next = c.result?.teeTimes[0];
          return (
            <li key={c.id} className="border-t border-border first:border-t-0">
              <Link
                href={searchHref({
                  ...defaultForm(now),
                  ...(c.kind === "course" ? {} : { play: "bays" as const, to: LATEST_BAY_TIME }),
                  date: next?.playDate ?? today,
                  courses: [c.slug],
                })}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium">
                  <span aria-hidden className="mr-1 text-star">
                    ★
                  </span>
                  {shortCourseName(c.name)}
                </span>
                <span className="text-right text-sm text-muted">
                  {next
                    ? `Next ${formatPerthTime(next.startTime)}${next.playDate === today ? "" : " tomorrow"}`
                    : "Nothing free today or tomorrow"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
