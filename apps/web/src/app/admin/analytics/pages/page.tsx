import { pageReport } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList } from "@/components/analytics/charts";
import { panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { formatCount, formatDuration, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

/** Analytics, pages (Milestone 23): the most viewed, and where visits start and end. */
export default async function AnalyticsPages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/pages");
  const range = rangeFromQuery(await searchParams);
  const report = await pageReport(getDb(), range);
  return (
    <AnalyticsFrame tab="pages" range={range} csv="pages">
      <Section title="Kinds of page">
        <div className={panel}>
          <BarList
            limit={20}
            rows={report.sections.map((s) => ({
              label: s.label,
              value: s.count,
              display: `${formatCount(s.count)} views · ${formatDuration(s.avgMs ?? 0)} each`,
            }))}
          />
        </div>
      </Section>
      <Section title="Every page">
        {report.pages.length === 0 ? (
          <p className="text-muted">No page views in these dates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Page</th>
                  <th className={`${thClass} text-right`}>Views</th>
                  <th className={`${thClass} text-right`}>Visitors</th>
                  <th className={`${thClass} text-right`}>Time on page</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((p) => (
                  <tr key={p.label}>
                    <td className={tdClass}>
                      {p.label.includes(":link") ? (
                        p.label
                      ) : (
                        <a href={p.label} className="break-all text-brand">
                          {p.label}
                        </a>
                      )}
                      <span className="block text-muted">{p.detail}</span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatCount(p.count)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatCount(p.visitors ?? 0)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatDuration(p.avgMs ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          Private pages (a golfer&apos;s booking or entry link) are grouped without the link itself.
          Time on page is how long it was on screen.
        </p>
      </Section>
      <div className="grid gap-8 md:grid-cols-2">
        <div className={panel}>
          <BarList
            title="Where visits start"
            rows={report.entries.map((e) => ({ label: e.label, detail: e.detail, value: e.count }))}
          />
        </div>
        <div className={panel}>
          <BarList
            title="Where visits end"
            rows={report.exits.map((e) => ({ label: e.label, detail: e.detail, value: e.count }))}
          />
        </div>
      </div>
    </AnalyticsFrame>
  );
}
