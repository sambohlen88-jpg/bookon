import type { Metadata } from "next";
import Link from "next/link";
import { formatPerthDay } from "@bookon/core";
import { cookies, headers } from "next/headers";
import {
  courseIdsForSlugs,
  listFavourites,
  listPushSubscriptions,
  listSearchableCourses,
  logSearch,
  searchTeeTimes,
  type Database,
  type SearchParams,
  type SearchResult,
} from "@bookon/db";
import { createAlertFromSearch } from "@/app/actions";
import { RefreshBar } from "@/components/refresh-bar";
import { CourseResults, NoMatchList } from "@/components/results";
import { SearchForm } from "@/components/search-form";
import { SiteHeader } from "@/components/site-header";
import { PushToggle } from "@/components/push-toggle";
import { Notice, primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { isBot } from "@/lib/bots";
import { bookLink } from "@/lib/click-token";
import { getDb } from "@/lib/db";
import { pushPublicKey } from "@/lib/push";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";
import {
  EARLIEST_TIME,
  LATEST_TIME,
  formatFormTime,
  parseSearchForm,
  searchHref,
  toSearchParams,
  type SearchForm as SearchFormValues,
} from "@/lib/search-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tee times · BookOn" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = new Date();
  const db = getDb();
  const courses = await listSearchableCourses(db);
  const query = await searchParams;
  const user = await currentUser();
  const favourites = user ? await listFavourites(db, user.id) : [];
  const favouriteIds = new Set(favourites.map((c) => c.id));
  const parsed = parseSearchForm(
    query,
    now,
    courses.map((c) => c.slug),
  );
  // "My courses only" swaps in the golfer's favourites.
  const mine = query.mine === "1" && favourites.length > 0;
  const form = mine ? { ...parsed, courses: favourites.map((c) => c.slug) } : parsed;
  const params = toSearchParams(form, now);
  const here = searchHref(form);
  const alertStatus = typeof query.alert === "string" ? query.alert : undefined;
  // Just set an alert, with no device getting notifications yet: offer them.
  const hasDevices =
    alertStatus === "created" && user
      ? (await listPushSubscriptions(db, user.id)).length > 0
      : false;
  const offerPush = alertStatus === "created" && user && !hasDevices ? await pushPublicKey() : null;
  const result = await searchTeeTimes(db, params, now);
  await recordSearch(db, params, result, now);
  const multiDay = params.dateFrom !== params.dateTo;
  const withTimes = result.courses.filter((c) => c.teeTimes.length > 0).length;
  // A handful of courses each get a card, so their notices show. Beyond that, courses with
  // nothing matching fold into one list.
  const fold = result.courses.length > 3;
  const cards = fold ? result.courses.filter((c) => c.teeTimes.length > 0) : result.courses;
  const folded = fold ? result.courses.filter((c) => c.teeTimes.length === 0) : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-4 lg:grid lg:max-w-6xl lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-6 lg:pt-8">
        {/* Desktop: the search stays open beside the results. */}
        <aside aria-label="Your search" className="hidden lg:sticky lg:top-6 lg:block">
          <div className="rounded-2xl border border-border p-5">
            <h2 className="mb-4 text-lg font-semibold">Your search</h2>
            <SearchForm
              values={form}
              courses={courses}
              now={now}
              favourites={favourites.length}
              mine={mine}
              idPrefix="d-"
            />
          </div>
        </aside>
        <div>
          <details className="rounded-xl bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">{summarise(form, params.dateTo)}</span>
              <span className="shrink-0 text-sm font-semibold text-brand">Change</span>
            </summary>
            <div className="px-4 pb-4">
              <SearchForm
                values={form}
                courses={courses}
                now={now}
                favourites={favourites.length}
                mine={mine}
              />
            </div>
          </details>

          <h1
            className="mt-6 text-2xl font-bold tracking-tight lg:mt-0 lg:text-3xl"
            aria-live="polite"
          >
            {result.totalTeeTimes === 0
              ? "No tee times match"
              : `${result.totalTeeTimes.toLocaleString("en-AU")} tee ${result.totalTeeTimes === 1 ? "time" : "times"} at ${withTimes} ${withTimes === 1 ? "course" : "courses"}`}
          </h1>

          {alertStatus === "created" && (
            <div className="mt-4">
              <Notice tone="info">
                Alert set. We&apos;ll{" "}
                {hasDevices ? "send a notification and an email" : `email ${user?.email ?? "you"}`}{" "}
                when a new time appears.{" "}
                <Link href="/account" className="underline">
                  Manage alerts
                </Link>
              </Notice>
              {offerPush && (
                <div className="mt-3 rounded-xl border border-border p-4">
                  <p className="mb-2 font-semibold">Want to hear even faster?</p>
                  <PushToggle publicKey={offerPush} />
                </div>
              )}
            </div>
          )}
          {alertStatus === "limit" && (
            <div className="mt-4">
              <Notice tone="warning">
                You already have 10 alerts. Delete one in{" "}
                <Link href="/account" className="underline">
                  My account
                </Link>{" "}
                to add another.
              </Notice>
            </div>
          )}

          {result.totalTeeTimes === 0 && <EmptyState form={form} />}
          {result.totalTeeTimes === 0 && alertStatus !== "created" && (
            <AlertCard here={here} signedIn={Boolean(user)} empty />
          )}

          <div className="mt-4 flex flex-col gap-4">
            {cards.map((r) => (
              <CourseResults
                key={r.course.id}
                result={r}
                multiDay={multiDay}
                oneCourse={result.courses.length === 1}
                now={now}
                favourite={user ? favouriteIds.has(r.course.id) : null}
                back={here}
                dayHref={(date) => searchHref({ ...form, date, days: 1, courses: [r.course.slug] })}
                courseHref={searchHref({ ...form, courses: [r.course.slug] })}
                bookHref={(t) =>
                  bookLink({
                    courseId: r.course.id,
                    startTime: t.startTime.toISOString(),
                    url: t.bookingUrl,
                    source: "search",
                  })
                }
              />
            ))}
            {folded.length > 0 && (
              <NoMatchList results={folded} now={now} others={cards.length > 0} />
            )}
          </div>

          {result.totalTeeTimes > 0 && alertStatus !== "created" && (
            <div className="mt-6">
              <AlertCard here={here} signedIn={Boolean(user)} />
            </div>
          )}

          <p className="mt-8 pb-16 text-xs text-muted">
            Times and prices come from each club&apos;s booking page and can change. You book and
            pay with the club.
          </p>
        </div>
        <RefreshBar renderedAt={now.toISOString()} />
      </main>
    </>
  );
}

function summarise(form: SearchFormValues, dateTo: string): string {
  const days =
    dateTo === form.date
      ? formatPerthDay(form.date)
      : `${formatPerthDay(form.date)} to ${formatPerthDay(dateTo)}`;
  const time =
    form.from === EARLIEST_TIME && form.to === LATEST_TIME
      ? "any time"
      : `${formatFormTime(form.from)} to ${formatFormTime(form.to)}`;
  const players = `${form.players} ${form.players === 1 ? "player" : "players"}`;
  const holes = form.holes === "any" ? "9 or 18 holes" : `${form.holes} holes`;
  return `${days} · ${time} · ${players} · ${holes}`;
}

function EmptyState({ form }: { form: SearchFormValues }) {
  const widen = [
    form.from !== EARLIEST_TIME || form.to !== LATEST_TIME
      ? {
          label: "Any time of day",
          href: searchHref({ ...form, from: EARLIEST_TIME, to: LATEST_TIME }),
        }
      : null,
    form.days < 7 ? { label: "The next 7 days", href: searchHref({ ...form, days: 7 }) } : null,
    form.holes !== "any"
      ? { label: "9 or 18 holes", href: searchHref({ ...form, holes: "any" }) }
      : null,
    form.courses.length > 0
      ? { label: "All courses", href: searchHref({ ...form, courses: [] }) }
      : null,
  ].filter((x): x is { label: string; href: string } => x !== null);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {widen.length > 0 && (
        <div>
          <p className="text-muted">Try a wider search:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {widen.map((w) => (
              <li key={w.label}>
                <Link
                  href={w.href}
                  prefetch={false}
                  className="flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium"
                >
                  {w.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Save this search as an alert, or sign in first and come back. */
function AlertCard({
  here,
  signedIn,
  empty = false,
}: {
  here: string;
  signedIn: boolean;
  empty?: boolean;
}) {
  return (
    <div className={`${empty ? "mt-4 " : ""}rounded-xl border border-border bg-surface p-4`}>
      <h2 className="font-semibold">
        {empty ? "Get told when a time opens up" : "Want something else?"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {empty
          ? "We'll check for cancellations and new times, and email you when one matches this search."
          : "We'll email you when a new time matches this search, like a cancellation."}
      </p>
      {signedIn ? (
        <form action={createAlertFromSearch} className="mt-3">
          <input type="hidden" name="query" value={here.replace(/^\/search\?/, "")} />
          <button type="submit" className={primaryButton}>
            Tell me when a time opens up
          </button>
        </form>
      ) : (
        <Link href={`/signin?next=${encodeURIComponent(here)}`} className={`${primaryButton} mt-3`}>
          Sign in to set an alert
        </Link>
      )}
    </div>
  );
}

/** Log the search for club reports. Skips bots and prefetches, and never breaks the page. */
async function recordSearch(db: Database, params: SearchParams, result: SearchResult, now: Date) {
  const requestHeaders = await headers();
  const sessionId = validSessionId((await cookies()).get(SESSION_COOKIE)?.value);
  if (!sessionId || isBot(requestHeaders.get("user-agent"))) return;
  if (requestHeaders.get("next-router-prefetch") || requestHeaders.get("purpose") === "prefetch")
    return;
  // A star or alert button re-renders the page; that isn't a new search.
  if (requestHeaders.get("next-action")) return;
  try {
    await logSearch(db, {
      sessionId,
      params,
      courseIds: await courseIdsForSlugs(db, params.courseSlugs ?? []),
      resultCount: result.totalTeeTimes,
      shownCourseIds: result.courses.filter((c) => c.teeTimes.length > 0).map((c) => c.course.id),
      now,
    });
  } catch (error) {
    console.error("[search] could not log search", error);
  }
}
