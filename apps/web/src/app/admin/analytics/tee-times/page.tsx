import {
  ANALYTICS_EVENTS,
  SORT_LABEL,
  percentChange,
  type AnalyticsEventName,
  type SortChoice,
} from "@bookon/core";
import { teeTimeReport } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList, DayHourGrid, Funnel, LineChart, StatTile } from "@/components/analytics/charts";
import { panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { formatCount, formatShare, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

/** Analytics, tee times (Milestone 23): searching to clicking through, what golfers look for, and each course. */
export default async function AnalyticsTeeTimes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/tee-times");
  const range = rangeFromQuery(await searchParams);
  const db = getDb();
  const r = await teeTimeReport(db, range, range.bucket);
  const before = await teeTimeReport(db, range.previous, range.bucket);
  const actionLabel = (name: string, detail: string | null | undefined) => {
    const what = ANALYTICS_EVENTS[name as AnalyticsEventName] ?? name;
    if (name === "sort" && detail)
      return `Sorted by ${(SORT_LABEL[detail as SortChoice] ?? detail).toLowerCase()}`;
    if (name === "filter" && detail) return `Filtered by ${detail}`;
    if (name === "near_me" && detail)
      return `${what} (${detail === "courses" ? "Courses page" : "search"})`;
    return what;
  };
  return (
    <AnalyticsFrame tab="tee-times" range={range} csv="courses">
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Searches"
          value={formatCount(r.searches)}
          change={percentChange(r.searches, before.searches)}
        />
        <StatTile
          label="Searches with nothing free"
          value={formatShare(r.emptySearches, r.searches)}
          change={percentChange(r.emptySearches, before.emptySearches)}
          lowerIsBetter
          hint="Searches that found no tee times. Worth a look: which days and times?"
        />
        <StatTile
          label="Clicks through to clubs"
          value={formatCount(r.clicks)}
          change={percentChange(r.clicks, before.clicks)}
          hint="Golfers sent to a club's booking page."
        />
        <StatTile
          label="Visitors who clicked through"
          value={formatShare(r.clickers, r.visitors)}
          hint="Of everyone who visited, the share who went on to a club's booking page."
        />
      </div>
      <div className="mb-8 grid gap-8">
        <div className={panel}>
          <Funnel
            title="From visiting to booking with a club"
            steps={[
              { label: "Visited BookOn", count: r.visitors },
              { label: "Searched for a tee time", count: r.searchers },
              { label: "Clicked through to a club", count: r.clickers },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            People, not visits. Bookings themselves happen on the club&apos;s site, so clicking
            through is as far as BookOn can see.
          </p>
        </div>
        <div className={panel}>
          <LineChart
            title="Searches and clicks to clubs"
            points={r.series}
            bucket={range.bucket}
            series={[
              { key: "searches", label: "Searches" },
              { key: "clicks", label: "Clicks to clubs" },
            ]}
          />
        </div>
      </div>
      <Section title="What golfers look for">
        <div className={`${panel} mb-6`}>
          <DayHourGrid title="The day and start time of the tee times searched for" grid={r.grid} />
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className={panel}>
            <BarList
              title="How far ahead"
              rows={r.leadTime.map((x) => ({
                label: x.label,
                value: x.count,
                display: `${formatCount(x.count)} · ${formatShare(x.count, r.searches)}`,
              }))}
            />
          </div>
          <div className={panel}>
            <BarList
              title="Players"
              rows={r.players.map((x) => ({
                label: x.label === "1" ? "1 player" : `${x.label} players`,
                value: x.count,
                display: `${formatCount(x.count)} · ${formatShare(x.count, r.searches)}`,
              }))}
            />
          </div>
          <div className={panel}>
            <BarList
              title="Holes"
              rows={r.holes.map((x) => ({
                label: x.label === "Any" ? "Either" : `${x.label} holes`,
                value: x.count,
                display: `${formatCount(x.count)} · ${formatShare(x.count, r.searches)}`,
              }))}
            />
          </div>
        </div>
      </Section>
      <Section title="Sorting and filters">
        <div className={panel}>
          <BarList
            empty="Nobody has sorted or filtered in these dates."
            rows={r.actions.map((a) => ({ label: actionLabel(a.label, a.detail), value: a.count }))}
          />
        </div>
      </Section>
      <Section title="Each course">
        {r.courses.length === 0 ? (
          <p className="text-muted">No course activity in these dates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Course</th>
                  <th className={`${thClass} text-right`}>In results</th>
                  <th className={`${thClass} text-right`}>Page views</th>
                  <th className={`${thClass} text-right`}>Clicks to club</th>
                  <th className={`${thClass} text-right`}>Click rate</th>
                </tr>
              </thead>
              <tbody>
                {r.courses.map((c) => (
                  <tr key={c.slug}>
                    <td className={tdClass}>
                      <a href={`/courses/${c.slug}`} className="text-brand">
                        {c.name}
                      </a>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatCount(c.shown)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatCount(c.views)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatCount(c.clicks)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatShare(c.clicks, c.shown)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          &ldquo;In results&rdquo; counts searches where the course showed with a tee time. Click
          rate is clicks to the club out of those.
        </p>
      </Section>
      <Section title="Tee time alerts">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Alerts set up"
            value={formatCount(r.alerts.created)}
            change={percentChange(r.alerts.created, before.alerts.created)}
          />
          <StatTile
            label="Confirmed"
            value={formatCount(r.alerts.confirmed)}
            hint="Golfers confirm their email before an alert starts."
          />
          <StatTile
            label="Alerts sent"
            value={formatCount(r.alerts.sent)}
            hint="Emails and phone notifications about new tee times."
          />
          <StatTile
            label="Clicks from alerts"
            value={`${formatCount(r.alerts.clicks)} · ${formatShare(r.alerts.clicks, r.alerts.sent)}`}
            hint="Golfers who went from an alert to a club's booking page."
          />
        </div>
      </Section>
    </AnalyticsFrame>
  );
}
