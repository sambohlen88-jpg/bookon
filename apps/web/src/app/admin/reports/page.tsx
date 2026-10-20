import { addPerthDays, formatPrice, perthToUtc } from "@bookon/core";
import { courseActivity, groupTotals, lessonTotals, unbookedReport } from "@bookon/db";
import { ReportRange, ReportTable } from "@/components/admin/report";
import { PageTitle } from "@/components/admin/ui";
import { UnbookedSection } from "@/components/admin/unbooked";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { reportRange } from "@/lib/report";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const now = new Date();
  const { from, to } = reportRange(await searchParams, now);
  // One after another: the local database takes one query at a time.
  const unbooked = await unbookedReport(getDb(), from, to, now);
  const lessons = await lessonTotals(
    getDb(),
    perthToUtc(from, "00:00"),
    perthToUtc(addPerthDays(to, 1), "00:00"),
  );
  const groups = await groupTotals(
    getDb(),
    perthToUtc(from, "00:00"),
    perthToUtc(addPerthDays(to, 1), "00:00"),
  );
  const rows = (await courseActivity(getDb(), from, to)).sort(
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions,
  );
  return (
    <>
      <PageTitle title="Reports" intro="What golfers did on BookOn, per course (Perth dates)." />
      <ReportRange from={from} to={to} csvHref={`/admin/reports/csv?from=${from}&to=${to}`} />
      <ReportTable rows={rows} />
      <section aria-labelledby="lesson-totals" className="mt-10">
        <h2 id="lesson-totals" className="text-xl font-semibold">
          Lessons booked through BookOn
        </h2>
        <p className="mt-1 text-sm text-muted">Requested in these dates. After refunds.</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Paid requests", String(lessons.requested)],
            ["Accepted by coaches", String(lessons.booked)],
            ["Paid to coaches", formatPrice(lessons.coachCents)],
            ["Booking fees", formatPrice(lessons.feeCents)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-6 font-semibold">Group sessions</h3>
        <p className="mt-1 text-sm text-muted">Paid in these dates. After refunds.</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Bookings", String(groups.bookings)],
            ["Spots", String(groups.spots)],
            ["Paid to coaches", formatPrice(groups.coachCents)],
            ["Booking fees", formatPrice(groups.feeCents)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <UnbookedSection
        report={unbooked}
        from={from}
        to={to}
        csvHref={`/admin/reports/unbooked-csv?from=${from}&to=${to}`}
      />
    </>
  );
}
