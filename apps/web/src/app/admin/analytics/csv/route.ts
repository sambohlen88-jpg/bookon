import { audienceReport, pageReport, sourceReport, teeTimeReport, visitorSeries } from "@bookon/db";
import { isAdminRequest } from "@/lib/access";
import { rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";
import { csvCell } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Analytics downloads (Milestone 23), for Excel or Google Sheets. Admin only. */
export async function GET(request: Request) {
  if (!(await isAdminRequest())) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const range = rangeFromQuery(Object.fromEntries(url.searchParams));
  const db = getDb();
  const report = url.searchParams.get("report");
  let rows: (string | number)[][];
  switch (report) {
    case "overview":
      rows = [
        ["When", "Visitors", "Page views"],
        ...(await visitorSeries(db, range, range.bucket)).map((p) => [
          p.key,
          p.values.visitors ?? 0,
          p.values.views ?? 0,
        ]),
      ];
      break;
    case "pages":
      rows = [
        ["Page", "Kind", "Views", "Visitors", "Average seconds on page"],
        ...(await pageReport(db, range)).pages.map((p) => [
          p.label,
          p.detail ?? "",
          p.count,
          p.visitors ?? 0,
          Math.round((p.avgMs ?? 0) / 1000),
        ]),
      ];
      break;
    case "sources":
      rows = [
        ["Source", "Channel", "Visits", "Visitors"],
        ...(await sourceReport(db, range, range.bucket)).sources.map((s) => [
          s.label,
          s.detail ?? "",
          s.count,
          s.visitors ?? 0,
        ]),
      ];
      break;
    case "places":
      rows = [
        ["City", "Region", "Visits"],
        ...(await audienceReport(db, range)).places.map((p) => [p.label, p.detail ?? "", p.count]),
      ];
      break;
    case "courses":
      rows = [
        ["Course", "In results", "Page views", "Clicks to club"],
        ...(await teeTimeReport(db, range, range.bucket)).courses.map((c) => [
          c.name,
          c.shown,
          c.views,
          c.clicks,
        ]),
      ];
      break;
    default:
      return new Response("Unknown report", { status: 400 });
  }
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookon-${report}-${range.from}-to-${range.to}.csv"`,
    },
  });
}
