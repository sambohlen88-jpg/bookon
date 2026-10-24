import { percentChange } from "@bookon/core";
import { accountReport } from "@bookon/db";
import { AnalyticsFrame } from "@/components/analytics/frame";
import { LineChart, StatTile } from "@/components/analytics/charts";
import { panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { formatCount, formatShare, rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

/** Analytics, accounts (Milestone 23): sign-ups and what signed-in golfers do. */
export default async function AnalyticsAccounts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/accounts");
  const range = rangeFromQuery(await searchParams);
  const db = getDb();
  const r = await accountReport(db, range, range.bucket);
  const b = await accountReport(db, range.previous, range.bucket);
  return (
    <AnalyticsFrame tab="accounts" range={range}>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="New accounts"
          value={formatCount(r.signups)}
          change={percentChange(r.signups, b.signups)}
        />
        <StatTile
          label="Sign-ins"
          value={formatCount(r.signIns)}
          change={percentChange(r.signIns, b.signIns)}
          hint="Each device signing in. Includes clubs and coaches."
        />
        <StatTile
          label="Favourite courses added"
          value={formatCount(r.favourites)}
          change={percentChange(r.favourites, b.favourites)}
        />
        <StatTile
          label="Courses rated"
          value={formatCount(r.ratings)}
          change={percentChange(r.ratings, b.ratings)}
        />
        <StatTile
          label="Tee time alerts set up"
          value={formatCount(r.alerts)}
          change={percentChange(r.alerts, b.alerts)}
        />
        <StatTile
          label="Searches shared"
          value={formatCount(r.shares)}
          change={percentChange(r.shares, b.shares)}
          hint="Times the Share button was opened."
        />
        <StatTile label="Install prompt shown" value={formatCount(r.installPrompts)} />
        <StatTile
          label="Installed the app"
          value={`${formatCount(r.installs)} · ${formatShare(r.installs, r.installPrompts)}`}
          hint="Android and desktop tell us when it's installed; iPhones don't, so those aren't counted."
        />
      </div>
      <div className={panel}>
        <LineChart
          title="New accounts and sign-ins"
          points={r.series}
          bucket={range.bucket}
          series={[
            { key: "signups", label: "New accounts" },
            { key: "signIns", label: "Sign-ins" },
          ]}
        />
      </div>
    </AnalyticsFrame>
  );
}
