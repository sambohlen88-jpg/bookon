import Link from "next/link";
import { percentChange } from "@bookon/core";
import { analyticsTotals, liveVisitors, pageReport, sourceReport, visitorSeries } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList, LineChart, StatTile } from "@/components/analytics/charts";
import { panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import {
  formatCount,
  formatDuration,
  formatShare,
  rangeFromQuery,
  rangeQuery,
} from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

type Query = Promise<Record<string, string | string[] | undefined>>;

/** Analytics overview (Milestone 23): the headline numbers, visitors over time, and who's on now. */
export default async function AnalyticsOverview({ searchParams }: { searchParams: Query }) {
  await requireAdmin("/admin/analytics");
  const range = rangeFromQuery(await searchParams);
  const db = getDb();
  const now = await analyticsTotals(db, range);
  const before = await analyticsTotals(db, range.previous);
  const series = await visitorSeries(db, range, range.bucket);
  const live = await liveVisitors(db, new Date());
  const pages = await pageReport(db, range);
  const sources = await sourceReport(db, range, range.bucket);
  const q = rangeQuery(range);

  return (
    <AnalyticsFrame tab="" range={range} csv="overview">
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Visitors"
          value={formatCount(now.visitors)}
          change={percentChange(now.visitors, before.visitors)}
          hint="Different people (browsers), counted once each."
        />
        <StatTile
          label="Visits"
          value={formatCount(now.visits)}
          change={percentChange(now.visits, before.visits)}
          hint="A visit ends after 30 minutes with nothing happening."
        />
        <StatTile
          label="Page views"
          value={formatCount(now.views)}
          change={percentChange(now.views, before.views)}
        />
        <StatTile
          label="Pages per visit"
          value={now.pagesPerVisit.toFixed(1)}
          change={percentChange(
            Math.round(now.pagesPerVisit * 10),
            Math.round(before.pagesPerVisit * 10),
          )}
        />
        <StatTile
          label="Time per visit"
          value={formatDuration(now.avgVisitMs)}
          change={percentChange(now.avgVisitMs, before.avgVisitMs)}
          hint="Time pages were on screen, on average per visit."
        />
        <StatTile
          label="Left after one page"
          value={formatShare(now.bounceRate, 1)}
          change={percentChange(
            Math.round(now.bounceRate * 1000),
            Math.round(before.bounceRate * 1000),
          )}
          lowerIsBetter
          hint="Visits that saw one page and left (the bounce rate). Lower is better."
        />
      </div>

      <div className={`${panel} mb-8`}>
        <LineChart
          title="Visitors and page views"
          points={series}
          bucket={range.bucket}
          series={[
            { key: "visitors", label: "Visitors" },
            { key: "views", label: "Page views" },
          ]}
        />
      </div>

      <Section title="Right now">
        <div className={panel}>
          <p>
            <strong className="text-2xl tabular-nums">{formatCount(live.visitors)}</strong>{" "}
            {live.visitors === 1 ? "visitor" : "visitors"} in the last 5 minutes
          </p>
          {live.pages.length > 0 && (
            <ul className="mt-3 text-sm">
              {live.pages.map((p) => (
                <li
                  key={p.path}
                  className="flex justify-between gap-3 border-t border-border py-1.5 first:border-t-0"
                >
                  <span className="min-w-0 truncate">
                    {p.path} <span className="text-muted">· {p.section}</span>
                  </span>
                  <span className="tabular-nums">{p.visitors}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <div className={panel}>
          <BarList
            title="Top pages"
            limit={6}
            rows={pages.pages.map((p) => ({ label: p.label, detail: p.detail, value: p.count }))}
          />
          <Link
            href={`/admin/analytics/pages${q}`}
            className="mt-3 inline-block text-sm font-medium text-brand"
          >
            All pages →
          </Link>
        </div>
        <div className={panel}>
          <BarList
            title="Where visits come from"
            limit={6}
            rows={sources.channels.map((c) => ({
              label: c.label,
              value: c.count,
              display: `${formatCount(c.count)} · ${formatShare(c.count, now.visits)}`,
            }))}
          />
          <Link
            href={`/admin/analytics/sources${q}`}
            className="mt-3 inline-block text-sm font-medium text-brand"
          >
            More on sources →
          </Link>
        </div>
      </div>
    </AnalyticsFrame>
  );
}
