import type { Metadata } from "next";
import Link from "next/link";
import { formatPerthDay } from "@bookon/core";
import { listSearchableCourses, searchTeeTimes } from "@bookon/db";
import { CourseResults, NoMatchList } from "@/components/results";
import { SearchForm } from "@/components/search-form";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";
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
  const form = parseSearchForm(
    await searchParams,
    now,
    courses.map((c) => c.slug),
  );
  const params = toSearchParams(form, now);
  const result = await searchTeeTimes(db, params, now);
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
      <main className="mx-auto max-w-md px-4 pb-12 pt-4">
        <details className="rounded-xl bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm">{summarise(form, params.dateTo)}</span>
            <span className="shrink-0 text-sm font-semibold text-brand">Change</span>
          </summary>
          <div className="px-4 pb-4">
            <SearchForm values={form} courses={courses} now={now} />
          </div>
        </details>

        <h1 className="mt-6 text-2xl font-bold tracking-tight" aria-live="polite">
          {result.totalTeeTimes === 0
            ? "No tee times match"
            : `${result.totalTeeTimes.toLocaleString("en-AU")} tee ${result.totalTeeTimes === 1 ? "time" : "times"} at ${withTimes} ${withTimes === 1 ? "course" : "courses"}`}
        </h1>

        {result.totalTeeTimes === 0 && <EmptyState form={form} />}

        <div className="mt-4 flex flex-col gap-4">
          {cards.map((r) => (
            <CourseResults
              key={r.course.id}
              result={r}
              multiDay={multiDay}
              oneCourse={result.courses.length === 1}
              now={now}
              dayHref={(date) => searchHref({ ...form, date, days: 1, courses: [r.course.slug] })}
            />
          ))}
          {folded.length > 0 && (
            <NoMatchList results={folded} now={now} others={cards.length > 0} />
          )}
        </div>

        <p className="mt-8 text-xs text-muted">
          Times and prices come from each club&apos;s booking page and can change. You book and pay
          with the club.
        </p>
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
                  className="flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium"
                >
                  {w.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Get told when a time opens up</h2>
        <p className="mt-1 text-sm text-muted">
          Alerts are coming soon. We&apos;ll email you when a matching tee time appears.
        </p>
      </div>
    </div>
  );
}
