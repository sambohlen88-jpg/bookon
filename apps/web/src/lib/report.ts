import { addPerthDays, perthDate } from "@bookon/core";
import type { CourseActivity } from "@bookon/db";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The report's Perth date range from the query string: the last 30 days by default. */
export function reportRange(
  query: Record<string, string | string[] | undefined>,
  now: Date,
): { from: string; to: string } {
  const today = perthDate(now);
  const to = typeof query.to === "string" && DATE.test(query.to) ? query.to : today;
  const from =
    typeof query.from === "string" && DATE.test(query.from) && query.from <= to
      ? query.from
      : addPerthDays(to, -29);
  return { from, to };
}

function cell(value: string | number): string {
  const text = String(value);
  // Quote anything with commas, quotes or line breaks, and stop spreadsheets running formulas.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Activity per course as CSV, for opening in Excel or Google Sheets. */
export function activityCsv(rows: CourseActivity[], from: string, to: string): string {
  const header = [
    "Course",
    "From",
    "To",
    "Searches",
    "Times shown",
    "Clicks",
    "Golfers",
    "From alerts",
    "From shares",
  ];
  const lines = rows.map((r) =>
    [r.name, from, to, r.searches, r.impressions, r.clicks, r.golfers, r.alertClicks, r.shareClicks]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
