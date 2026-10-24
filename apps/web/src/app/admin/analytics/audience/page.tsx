import { perthDate } from "@bookon/core";
import { audienceReport, returnCohorts } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList, StatTile, heatClass } from "@/components/analytics/charts";
import { panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { bucketLabel, formatCount, formatShare, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

/** Analytics, who visitors are (Milestone 23): devices, places, new or returning, and who comes back. */
export default async function AnalyticsAudience({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/audience");
  const range = rangeFromQuery(await searchParams);
  const db = getDb();
  const report = await audienceReport(db, range);
  const cohorts = await returnCohorts(db, perthDate(new Date()));
  const people = report.newVisitors + report.returningVisitors;
  const share = (rows: { label: string; count: number }[]) =>
    rows.map((r) => ({
      label: r.label,
      value: r.count,
      display: `${formatCount(r.count)} · ${formatShare(r.count, report.visits)}`,
    }));
  return (
    <AnalyticsFrame tab="audience" range={range} csv="places">
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="New visitors"
          value={formatCount(report.newVisitors)}
          hint="First time on BookOn in these dates."
        />
        <StatTile
          label="Returning visitors"
          value={`${formatCount(report.returningVisitors)} · ${formatShare(report.returningVisitors, people)}`}
          hint="Had visited before these dates."
        />
        <StatTile
          label="Visits from the installed app"
          value={formatShare(report.appVisits, report.visits)}
        />
        <StatTile
          label="Visits signed in"
          value={formatShare(report.signedInVisits, report.visits)}
        />
      </div>
      <div className="mb-8 grid gap-8 md:grid-cols-3">
        <div className={panel}>
          <BarList title="Devices" rows={share(report.devices)} />
        </div>
        <div className={panel}>
          <BarList title="Browsers" rows={share(report.browsers)} />
        </div>
        <div className={panel}>
          <BarList title="Systems" rows={share(report.systems)} />
        </div>
      </div>
      <Section title="Where they are">
        <div className={panel}>
          <BarList
            limit={15}
            empty="No places yet."
            rows={report.places.map((p) => ({
              label: p.label,
              detail: p.detail || null,
              value: p.count,
            }))}
          />
          <p className="mt-3 text-sm text-muted">
            From the website host&apos;s rough location (city, not street). BookOn keeps no IP
            addresses. On your own computer this shows as Unknown.
          </p>
        </div>
      </Section>
      <Section title="Do they come back?">
        <p className="mb-3 text-sm text-muted">
          Visitors grouped by the week they first came, and the share who visited again each week
          after.
        </p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th className="pr-3 text-left font-semibold">First came</th>
                <th className="pr-3 text-right font-semibold">Visitors</th>
                {Array.from({ length: 8 }, (_, k) => (
                  <th key={k} className="w-14 text-center font-normal text-muted">
                    {k === 0 ? "Week 1" : `+${k}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="whitespace-nowrap pr-3">{bucketLabel(c.week, "week")}</td>
                  <td className="pr-3 text-right tabular-nums">{formatCount(c.visitors)}</td>
                  {Array.from({ length: 8 }, (_, k) => {
                    const n = c.returned[k];
                    if (n === undefined) return <td key={k} />;
                    const s = c.visitors ? n / c.visitors : 0;
                    return (
                      <td
                        key={k}
                        title={`${formatCount(n)} of ${formatCount(c.visitors)}`}
                        className={`rounded-sm px-1 py-1 text-center tabular-nums ${k === 0 ? "bg-surface" : heatClass(s)}`}
                      >
                        {c.visitors ? formatShare(n, c.visitors) : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </AnalyticsFrame>
  );
}
