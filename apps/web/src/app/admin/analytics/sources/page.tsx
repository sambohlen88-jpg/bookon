import { sourceReport } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList, LineChart } from "@/components/analytics/charts";
import { panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { formatCount, formatShare, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

const ABOUT: Record<string, string> = {
  Search: "Google and other search engines",
  Social: "Facebook, Instagram and other social sites",
  Email: "BookOn's own emails (alerts, bookings) and webmail",
  Campaign: "Links you tagged, like a flyer or ad",
  "Other sites": "Links on other websites",
  Direct: "Typed in, bookmarked, or from an app",
};

/** Analytics, where visits come from (Milestone 23). */
export default async function AnalyticsSources({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/sources");
  const range = rangeFromQuery(await searchParams);
  const report = await sourceReport(getDb(), range, range.bucket);
  const visits = report.channels.reduce((s, c) => s + c.count, 0);
  const top = report.channels.slice(0, 2);
  return (
    <AnalyticsFrame tab="sources" range={range} csv="sources">
      <div className="mb-8 grid gap-8 md:grid-cols-2">
        <div className={panel}>
          <BarList
            title="Visits by channel"
            rows={report.channels.map((c) => ({
              label: c.label,
              detail: ABOUT[c.label],
              value: c.count,
              display: `${formatCount(c.count)} · ${formatShare(c.count, visits)}`,
            }))}
          />
        </div>
        <div className={panel}>
          <BarList
            title="Sources"
            limit={15}
            rows={report.sources.map((s) => ({ label: s.label, detail: s.detail, value: s.count }))}
          />
        </div>
      </div>
      {top.length > 0 && (
        <div className={`${panel} mb-8`}>
          <LineChart
            title={`Visits from ${top.map((t) => t.label.toLowerCase()).join(" and ")}`}
            points={report.series}
            bucket={range.bucket}
            series={top.map((t) => ({ key: t.label, label: t.label }))}
          />
        </div>
      )}
      <Section title="Campaigns">
        <div className={panel}>
          <BarList
            empty="No tagged links yet. Add ?utm_source=flyer&utm_campaign=spring to a link you share, and visits from it show here. BookOn's own emails are tagged already."
            rows={report.campaigns.map((c) => ({
              label: c.label,
              detail: c.detail,
              value: c.count,
            }))}
          />
        </div>
      </Section>
    </AnalyticsFrame>
  );
}
