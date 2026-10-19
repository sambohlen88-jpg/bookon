import type { Metadata } from "next";
import { WEEKDAYS, formatPerthDay, perthDate } from "@bookon/core";
import {
  DAY_PARTS,
  courseActivity,
  listCourseDetails,
  pitchContact,
  unbookedReport,
} from "@bookon/db";
import { CourseArt } from "@/components/course-art";
import { PrintButton } from "@/components/admin/print-button";
import { fieldLabel } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { reportRange } from "@/lib/report";

export const metadata: Metadata = { title: "Pitch report · BookOn", robots: { index: false } };

const n = (value: number) => value.toLocaleString("en-AU");
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-AU")}`;

/**
 * A one-page report to show a club what BookOn did for it: golfers who saw
 * and clicked its tee times, and the tee times that went unbooked. Admins
 * print it or save it as a PDF from the browser.
 */
export default async function PitchReport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const now = new Date();
  const { from, to } = reportRange(query, now);
  const db = getDb();
  // One after another: the local database takes one query at a time.
  const golf = (await listCourseDetails(db)).filter((c) => c.kind === "course");
  const course = golf.find((c) => c.slug === query.course) ?? golf[0];
  const activity = (await courseActivity(db, from, to)).find((a) => a.courseId === course?.id);
  const unbooked = await unbookedReport(db, from, to, now);
  const row = unbooked.rows.find((r) => r.courseId === course?.id);
  const contact = await pitchContact(db);
  if (!course) return <p className="text-muted">No golf courses yet.</p>;

  const range =
    from === to ? formatPerthDay(from) : `${formatPerthDay(from)} to ${formatPerthDay(to)}`;
  const weekdays = WEEKDAYS.map((d, i) => ({ label: d, count: row?.byWeekday[i] ?? 0 }));
  const parts = DAY_PARTS.map((p) => ({ label: p.name, count: row?.byPart[p.id] ?? 0 }));

  return (
    <>
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 print:hidden"
        aria-label="Choose the report"
      >
        <div>
          <label htmlFor="course" className={fieldLabel}>
            Course
          </label>
          <select id="course" name="course" defaultValue={course.slug} className={textInput}>
            {golf.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className={fieldLabel}>
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className={textInput} />
        </div>
        <div>
          <label htmlFor="to" className={fieldLabel}>
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className={textInput} />
        </div>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
        <PrintButton />
      </form>

      {/* The page itself: sized for one A4 sheet. */}
      <article className="pitch mx-auto max-w-[190mm] rounded-xl border border-border bg-background p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold text-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon.svg" alt="" width={28} height={28} />
              BookOn
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{course.name} on BookOn</h1>
            <p className="mt-1 text-muted">
              {range} · {course.suburb}
            </p>
          </div>
          <CourseArt
            slug={course.slug}
            className="hidden h-24 w-40 shrink-0 overflow-hidden rounded-lg sm:block print:block"
          />
        </header>

        <section
          aria-label="Golfers"
          className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 print:grid-cols-4"
        >
          <Stat value={n(activity?.searches ?? 0)} label="searches included your course" />
          <Stat value={n(activity?.impressions ?? 0)} label="times golfers saw your tee times" />
          <Stat
            value={n(activity?.clicks ?? 0)}
            label={`clicks to your booking page${activity?.golfers ? `, from ${n(activity.golfers)} golfers` : ""}`}
          />
          <Stat value={n(activity?.alertClicks ?? 0)} label="from alerts about new times" />
        </section>

        <section
          aria-labelledby="unbooked"
          className="mt-8 rounded-xl bg-surface p-5 print:bg-surface"
        >
          <h2 id="unbooked" className="text-lg font-semibold">
            Tee times that went unbooked
          </h2>
          <p className="mt-2 text-2xl font-bold">
            {n(row?.unbooked ?? 0)} tee times · {n(row?.spots ?? 0)} empty player spots
            {row && row.valueCents > 0 ? ` · about ${dollars(row.valueCents)} in green fees` : ""}
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2 print:grid-cols-2">
            <Bars title="By day of the week" rows={weekdays} />
            <Bars title="By time of day" rows={parts} />
          </div>
        </section>

        <section aria-labelledby="gets" className="mt-8">
          <h2 id="gets" className="text-lg font-semibold">
            What BookOn does for {course.name}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2 print:grid-cols-2">
            <li>✓ Your free tee times in one search, next to every Perth public course.</li>
            <li>✓ Golfers book and pay on your own booking page. Every booking stays yours.</li>
            <li>✓ Alerts tell golfers straight away when a cancellation frees a time.</li>
            <li>✓ A free listing, with a monthly report like this one.</li>
          </ul>
        </section>

        <footer className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4 text-sm">
          <div>
            <p className="font-semibold">Talk to us</p>
            <p className="text-muted">
              {[contact.name, contact.phone, contact.email].filter(Boolean).join(" · ") ||
                "Add your contact details in Admin, Settings."}
            </p>
          </div>
          <p className="max-w-md text-xs text-muted">
            Unbooked tee times were still free in a check within the hour before they started.
            {row?.coverage != null
              ? ` BookOn checked ${Math.round(row.coverage * 100)}% of the golfing day in this period; times it didn't check aren't counted.`
              : " Recording hadn't started for this period."}{" "}
            Prepared {formatPerthDay(perthDate(now))}.
          </p>
        </footer>
      </article>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-3xl font-bold tabular-nums text-brand">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

/** Simple bars: the share of unbooked tee times on each day or time. */
function Bars({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
            <span className="text-muted">{r.label}</span>
            <span className="h-3 rounded-full bg-background">
              <span
                className="block h-3 rounded-full bg-brand"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{n(r.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
