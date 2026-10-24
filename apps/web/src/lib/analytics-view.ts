import { analyticsRange, perthDate, type AnalyticsRange } from "@bookon/core";

/** Reading and showing analytics in Admin (Milestone 23). */

export const ANALYTICS_TABS = [
  { slug: "", label: "Overview" },
  { slug: "pages", label: "Pages" },
  { slug: "sources", label: "Where from" },
  { slug: "audience", label: "Who" },
  { slug: "tee-times", label: "Tee times" },
  { slug: "bookings", label: "Coaching & events" },
  { slug: "accounts", label: "Accounts" },
  { slug: "speed", label: "Speed" },
] as const;

export function rangeFromQuery(
  query: Record<string, string | string[] | undefined>,
  now = new Date(),
): AnalyticsRange {
  const one = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : null);
  return analyticsRange({ range: one("range"), from: one("from"), to: one("to") }, perthDate(now));
}

/** The range as a query string, to keep it when moving between tabs. */
export function rangeQuery(range: AnalyticsRange): string {
  return range.preset === "custom"
    ? `?range=custom&from=${range.from}&to=${range.to}`
    : `?range=${range.preset}`;
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-AU");
}

export function formatShare(part: number, whole: number): string {
  if (!whole) return "–";
  const pct = (part / whole) * 100;
  return `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/** "45s", "2m 05s", "1h 10m". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A chart bucket's label: "13:00", "Sat 17 Oct" or "w/c 12 Oct". */
export function bucketLabel(key: string, bucket: "hour" | "day" | "week", short = false): string {
  if (bucket === "hour") return `${key.slice(11, 13)}:00`;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const day = `${d} ${MONTHS[m! - 1]}`;
  if (bucket === "week") return short ? day : `Week of ${day}`;
  return short
    ? day
    : `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()]} ${day}`;
}
