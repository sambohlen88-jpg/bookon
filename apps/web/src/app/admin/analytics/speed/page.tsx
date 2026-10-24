import { VITALS, vitalRating, type VitalName } from "@bookon/core";
import { speedReport, type VitalRow } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { formatCount, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

const ORDER: VitalName[] = ["LCP", "INP", "CLS", "FCP", "TTFB"];
const DOT = {
  good: "bg-status-good",
  "needs work": "bg-status-warn",
  poor: "bg-status-poor",
} as const;

function value(metric: VitalName, v: number): string {
  return metric === "CLS"
    ? v.toFixed(2)
    : v >= 1000
      ? `${(v / 1000).toFixed(1)}s`
      : `${Math.round(v)}ms`;
}

/** A rating always shows as a word, with the colour beside it. */
function Rated({ metric, v }: { metric: VitalName; v: number }) {
  const rating = vitalRating(metric, v);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`inline-block size-2.5 rounded-full ${DOT[rating]}`} />
      <span className="tabular-nums">{value(metric, v)}</span>
      <span className="text-muted">{rating}</span>
    </span>
  );
}

function Grid({ rows, groups, label }: { rows: VitalRow[]; groups: string[]; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>{label}</th>
            {ORDER.slice(0, 3).map((m) => (
              <th key={m} className={thClass}>
                {VITALS[m].label}
              </th>
            ))}
            <th className={`${thClass} text-right`}>Samples</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const mine = rows.filter((r) => r.group === g);
            return (
              <tr key={g}>
                <td className={tdClass}>{g}</td>
                {ORDER.slice(0, 3).map((m) => {
                  const r = mine.find((x) => x.metric === m);
                  return (
                    <td key={m} className={tdClass}>
                      {r ? <Rated metric={m} v={r.p75} /> : <span className="text-muted">–</span>}
                    </td>
                  );
                })}
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatCount(Math.max(0, ...mine.map((x) => x.samples)))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Analytics, speed (Milestone 23): real loading times from golfers' devices. */
export default async function AnalyticsSpeed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/speed");
  const range = rangeFromQuery(await searchParams);
  const r = await speedReport(getDb(), range);
  const devices = [...new Set(r.byDevice.map((x) => x.group))].sort();
  const sections = [...new Set(r.bySection.map((x) => x.group))].sort(
    (a, b) =>
      Math.max(0, ...r.bySection.filter((x) => x.group === b).map((x) => x.samples)) -
      Math.max(0, ...r.bySection.filter((x) => x.group === a).map((x) => x.samples)),
  );
  return (
    <AnalyticsFrame tab="speed" range={range}>
      <p className="mb-6 text-sm text-muted">
        Measured on golfers&apos; own phones and computers, as Google measures it for search
        rankings: 3 in 4 page loads were at least this quick.
      </p>
      {r.overall.length === 0 ? (
        <p className="text-muted">No loading times in these dates yet.</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ORDER.map((m) => {
              const row = r.overall.find((x) => x.metric === m);
              return (
                <div key={m} className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted">{VITALS[m].label}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {row ? <Rated metric={m} v={row.p75} /> : "–"}
                  </p>
                  <p className="text-xs text-muted">Good is under {value(m, VITALS[m].good)}</p>
                </div>
              );
            })}
          </div>
          <Section title="Phones and computers">
            <div className={panel}>
              <Grid rows={r.byDevice} groups={devices} label="Device" />
            </div>
          </Section>
          <Section title="By kind of page">
            <div className={panel}>
              <Grid rows={r.bySection} groups={sections} label="Page" />
            </div>
          </Section>
        </>
      )}
    </AnalyticsFrame>
  );
}
