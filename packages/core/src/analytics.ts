/**
 * BookOn's own analytics (Milestone 23): what a page view is called, where
 * a visitor came from, and what device they're on. No IP addresses and no
 * outside services; private links (with tokens in them) are never stored.
 */

/** A visit ends after this long with nothing happening. */
export const VISIT_MINUTES = 30;
/** Raw page views and events are deleted after this many months. */
export const ANALYTICS_KEEP_MONTHS = 13;

/** Pages that aren't counted: the admin, club, coach and author portals, sign-in and dev pages. */
export function analyticsExcluded(pathname: string): boolean {
  return /^\/(admin|club|coach|dev|auth|api|go|calendar|write)(\/|$)/.test(pathname);
}

/** Private pages reached by a link with a token in it. The token is never stored. */
const PRIVATE: [RegExp, string, string][] = [
  [/^\/alerts\/[^/]+/, "/alerts/:link", "Alert settings"],
  [/^\/lessons\/[^/]+/, "/lessons/:link", "Lesson booking (golfer's page)"],
  [/^\/sessions\/[^/]+/, "/sessions/:link", "Group booking (golfer's page)"],
  [/^\/entries\/[^/]+/, "/entries/:link", "Event entry (golfer's page)"],
  [/^\/matchplay\/entry\/[^/]+/, "/matchplay/entry/:link", "Match play (player's page)"],
  [/^\/clubs\/join\/[^/]+.*/, "/clubs/join/:link", "Club sign-up form"],
];

/** Public pages, by the kind of page they are. */
const SECTIONS: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/search$/, "Search results"],
  [/^\/courses$/, "Courses"],
  [/^\/courses\/[^/]+$/, "Course page"],
  [/^\/coaches$/, "Find a coach"],
  [/^\/coaches\/[^/]+$/, "Coach page"],
  [/^\/coaches\/[^/]+\/book$/, "Lesson booking"],
  [/^\/coaches\/[^/]+\/sessions\/[^/]+$/, "Group session"],
  [/^\/coaching$/, "Golf lessons"],
  [/^\/competitions$/, "Competitions"],
  [/^\/competitions\/[^/]+$/, "Event page"],
  [/^\/matchplay\/[^/]+$/, "Match play"],
  [/^\/golf(\/[^/]+)?$/, "Golf in Perth"],
  [/^\/clubs(\/join)?$/, "For golf clubs"],
  [/^\/s\/[^/]+$/, "Shared search"],
  [/^\/news$/, "News"],
  [/^\/news\/[^/]+$/, "News article"],
  [/^\/(privacy|terms)$/, "Privacy and terms"],
  [/^\/account$/, "My account"],
  [/^\/signin$/, "Sign in"],
];

export interface PageName {
  /** The path as stored: query strings dropped, tokens replaced. */
  path: string;
  /** The kind of page, for grouping. */
  section: string;
}

export function pageName(rawPath: string): PageName | null {
  let path = rawPath.split(/[?#]/)[0] ?? "/";
  if (!path.startsWith("/") || path.length > 300) return null;
  path = path.replace(/\/+$/, "") || "/";
  if (analyticsExcluded(path)) return null;
  for (const [pattern, safe, section] of PRIVATE)
    if (pattern.test(path)) return { path: safe, section };
  for (const [pattern, section] of SECTIONS) if (pattern.test(path)) return { path, section };
  return { path, section: "Other" };
}

/** Things visitors do that the analytics count, besides page views. */
export const ANALYTICS_EVENTS = {
  sort: "Sorted the results",
  filter: "Used a filter",
  near_me: "Used Near me",
  tee_sheet_day: "Changed day on a tee sheet",
  share: "Shared a search",
  install_prompt: "Saw the install prompt",
  install: "Installed the app",
} as const;
export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

export function isAnalyticsEvent(name: string): name is AnalyticsEventName {
  return Object.hasOwn(ANALYTICS_EVENTS, name);
}

/* Devices */

export type DeviceKind = "Phone" | "Tablet" | "Desktop";

export interface Device {
  device: DeviceKind;
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string): Device {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /CrOS/.test(ua)
        ? "ChromeOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Other";
  const browser = /FBAN|FBAV|FB_IAB/.test(ua)
    ? "Facebook app"
    : /Instagram/.test(ua)
      ? "Instagram app"
      : /EdgA?\/|Edg\//.test(ua)
        ? "Edge"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /OPR\/|Opera/.test(ua)
            ? "Opera"
            : /Firefox|FxiOS/.test(ua)
              ? "Firefox"
              : /Chrome|CriOS/.test(ua)
                ? "Chrome"
                : /Safari/.test(ua)
                  ? "Safari"
                  : "Other";
  const device: DeviceKind =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? "Tablet"
      : /Mobi|iPhone|iPod|Android/.test(ua)
        ? "Phone"
        : "Desktop";
  return { device, browser, os };
}

const BOTS =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|httpclient/i;

/** Search engines, link previews, uptime checks and scripts. */
export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOTS.test(ua);
}

/** Phone, tablet or desktop by screen width, when the browser doesn't say. */
export function deviceForWidth(width: number): DeviceKind {
  return width < 600 ? "Phone" : width < 1024 ? "Tablet" : "Desktop";
}

/* Where visitors come from */

export type Channel = "Search" | "Social" | "Email" | "Campaign" | "Other sites" | "Direct";

export interface Utm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}

export interface TrafficSource {
  channel: Channel;
  /** "Google", "Facebook", "BookOn emails", a site's address, or "Direct". */
  source: string;
  /** The other site's address, if any. */
  referrerHost: string | null;
}

const SEARCH_ENGINES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
];
const WEBMAIL = /^(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com)$/;

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Sort a visit into a channel, from the page it came from and any campaign tags. */
export function trafficSource(input: {
  referrer: string | null | undefined;
  ownHost: string;
  utm?: Utm;
}): TrafficSource | null {
  const host = hostOf(input.referrer);
  const own = input.ownHost.replace(/^www\./, "").toLowerCase();
  // Moving between BookOn's own pages isn't a new source.
  if (host === own) return null;
  const utm = input.utm ?? {};
  const medium = utm.medium?.toLowerCase();
  if (medium === "email" || WEBMAIL.test(host ?? ""))
    return {
      channel: "Email",
      source: utm.source === "bookon" ? "BookOn emails" : utm.source || host || "Email",
      referrerHost: host,
    };
  if (host)
    for (const [pattern, name] of SEARCH_ENGINES)
      if (pattern.test(host)) return { channel: "Search", source: name, referrerHost: host };
  if (host)
    for (const [pattern, name] of SOCIAL)
      if (pattern.test(host)) return { channel: "Social", source: name, referrerHost: host };
  if (utm.source) return { channel: "Campaign", source: utm.source, referrerHost: host };
  if (host) return { channel: "Other sites", source: host, referrerHost: host };
  return { channel: "Direct", source: "Direct", referrerHost: null };
}

/* Speed (Core Web Vitals) */

export type VitalName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";

/** Google's "good" and "poor" lines for each measure. */
export const VITALS: Record<
  VitalName,
  { label: string; good: number; poor: number; unit: string }
> = {
  LCP: { label: "Main content shown", good: 2500, poor: 4000, unit: "ms" },
  INP: { label: "Response to taps", good: 200, poor: 500, unit: "ms" },
  CLS: { label: "Layout shifting", good: 0.1, poor: 0.25, unit: "" },
  FCP: { label: "First content shown", good: 1800, poor: 3000, unit: "ms" },
  TTFB: { label: "Server response", good: 800, poor: 1800, unit: "ms" },
};

export function vitalRating(name: VitalName, value: number): "good" | "needs work" | "poor" {
  const v = VITALS[name];
  return value <= v.good ? "good" : value <= v.poor ? "needs work" : "poor";
}

/* Date ranges */

export type RangePreset = "today" | "7d" | "30d" | "90d" | "12m" | "custom";
export const RANGE_LABEL: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  custom: "Your dates",
};

export interface AnalyticsRange {
  preset: RangePreset;
  /** Perth dates, inclusive. */
  from: string;
  to: string;
  days: number;
  /** The same length just before, for comparison. */
  previous: { from: string; to: string };
  /** How the chart groups time. */
  bucket: "hour" | "day" | "week";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}
function fromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** Read a range from the page's address: a preset, or from and to dates. */
export function analyticsRange(
  input: { range?: string | null; from?: string | null; to?: string | null },
  today: string,
): AnalyticsRange {
  let preset = (input.range ?? "30d") as RangePreset;
  let from: string;
  let to = today;
  if (
    preset === "custom" &&
    input.from &&
    input.to &&
    DATE.test(input.from) &&
    DATE.test(input.to)
  ) {
    [from, to] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from];
    if (to > today) to = today;
    // At most two years.
    if (dayNumber(to) - dayNumber(from) > 730) from = fromDayNumber(dayNumber(to) - 730);
  } else {
    const back = { today: 0, "7d": 6, "30d": 29, "90d": 89, "12m": 364 }[
      preset as Exclude<RangePreset, "custom">
    ];
    if (back === undefined) preset = "30d";
    from = fromDayNumber(dayNumber(today) - (back ?? 29));
  }
  const days = dayNumber(to) - dayNumber(from) + 1;
  const previous = {
    from: fromDayNumber(dayNumber(from) - days),
    to: fromDayNumber(dayNumber(from) - 1),
  };
  return {
    preset,
    from,
    to,
    days,
    previous,
    bucket: days === 1 ? "hour" : days <= 92 ? "day" : "week",
  };
}

/** Change against the previous period, as a whole percentage, or null when there's nothing to compare. */
export function percentChange(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / before) * 100);
}
