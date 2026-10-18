/**
 * Print BookOn activity per course, until the admin dashboard (Milestone 6) exists.
 *
 *   pnpm stats                          last 30 days
 *   pnpm stats -- --from 2026-10-01 --to 2026-10-31
 */
import { parseArgs } from "node:util";
import { addPerthDays, perthDate } from "@bookon/core";
import { LOCAL_DATABASE_URL, createDb } from "../client";
import { courseActivity } from "../tracking";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: { from: { type: "string" }, to: { type: "string" } },
});
const to = values.to ?? perthDate(new Date());
const from = values.from ?? addPerthDays(to, -29);

const handle = createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL);
const rows = (await courseActivity(handle.db, from, to)).filter(
  (r) => r.searches + r.impressions + r.clicks > 0,
);
await handle.close();

console.log(`BookOn activity, ${from} to ${to} (Perth dates)\n`);
if (rows.length === 0) {
  console.log("Nothing recorded yet. Search and click Book on the site, then run this again.");
} else {
  console.table(
    rows
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .map((r) => ({
        Course: r.name,
        Searches: r.searches,
        Shown: r.impressions,
        Clicks: r.clicks,
        Golfers: r.golfers,
        "From alerts": r.alertClicks,
        "From shares": r.shareClicks,
      })),
  );
}
