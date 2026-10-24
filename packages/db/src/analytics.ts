import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import {
  ANALYTICS_KEEP_MONTHS,
  PERTH_TIME_ZONE,
  VISIT_MINUTES,
  addPerthDays,
  isAnalyticsEvent,
  isBot,
  pageName,
  parseUserAgent,
  perthToUtc,
  trafficSource,
  type DeviceKind,
  type Utm,
  type VitalName,
  VITALS,
  deviceForWidth,
} from "@bookon/core";
import { logChange, type Actor } from "./admin";
import type { Database } from "./client";
import { analyticsEvents, appSettings, pageViews, webVitals } from "./schema";

/**
 * BookOn's own analytics (Milestone 23): recording page views, actions and
 * loading times, and the totals behind Admin, Analytics.
 */

/* Recording */

export interface PageViewInput {
  visitorId: string;
  path: string;
  referrer: string | null;
  /** BookOn's own address, so moving between our pages isn't counted as a source. */
  ownHost: string;
  utm: Utm;
  userAgent: string | null;
  /** Screen width, for phones that don't say what they are. */
  width: number | null;
  /** Opened from the home screen app. */
  app: boolean;
  signedIn: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
}

const clip = (text: string | null | undefined, max: number) =>
  text ? text.trim().slice(0, max) || null : null;

/**
 * Record a page view, starting a new visit after VISIT_MINUTES of nothing.
 * Returns its id (to record the time on the page later), or null when it
 * isn't counted (portals, bots).
 */
export async function recordPageView(
  db: Database,
  input: PageViewInput,
  now: Date,
): Promise<string | null> {
  const page = pageName(input.path);
  if (!page || isBot(input.userAgent)) return null;
  const [last] = await db
    .select({ at: pageViews.at, visitId: pageViews.visitId })
    .from(pageViews)
    .where(eq(pageViews.visitorId, input.visitorId))
    .orderBy(desc(pageViews.at))
    .limit(1);
  const continuing = last && now.getTime() - last.at.getTime() < VISIT_MINUTES * 60_000;
  const from = continuing
    ? null
    : (trafficSource({ referrer: input.referrer, ownHost: input.ownHost, utm: input.utm }) ?? {
        channel: "Direct" as const,
        source: "Direct",
        referrerHost: null,
      });
  const ua = parseUserAgent(input.userAgent ?? "");
  // A desktop browser on a phone-sized screen is usually a phone asking for the desktop site.
  const device: DeviceKind =
    ua.device === "Desktop" && input.width && input.width < 600
      ? deviceForWidth(input.width)
      : ua.device;
  const [row] = await db
    .insert(pageViews)
    .values({
      at: now,
      visitorId: input.visitorId,
      visitId: continuing ? last!.visitId : randomUUID(),
      entry: !continuing,
      path: page.path,
      section: page.section,
      channel: from?.channel ?? null,
      source: clip(from?.source, 100),
      referrerHost: clip(from?.referrerHost, 100),
      utmSource: continuing ? null : clip(input.utm.source, 100),
      utmMedium: continuing ? null : clip(input.utm.medium, 100),
      utmCampaign: continuing ? null : clip(input.utm.campaign, 100),
      device,
      browser: ua.browser,
      os: ua.os,
      app: input.app,
      signedIn: input.signedIn,
      country: clip(input.country, 60),
      region: clip(input.region, 60),
      city: clip(input.city, 80),
    })
    .returning({ id: pageViews.id });
  return row!.id;
}

/** How long a page was on screen. Only the visitor who viewed it can set it. */
export async function recordTimeOnPage(
  db: Database,
  id: string,
  visitorId: string,
  ms: number,
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(ms) || ms < 0) return;
  await db
    .update(pageViews)
    .set({ durationMs: Math.min(Math.round(ms), VISIT_MINUTES * 60_000) })
    .where(and(eq(pageViews.id, id), eq(pageViews.visitorId, visitorId)));
}

export async function recordEvent(
  db: Database,
  input: { visitorId: string; name: string; path: string | null; label: string | null },
  now: Date,
): Promise<boolean> {
  if (!isAnalyticsEvent(input.name)) return false;
  const page = input.path ? pageName(input.path) : null;
  await db.insert(analyticsEvents).values({
    at: now,
    visitorId: input.visitorId,
    name: input.name,
    section: page?.section ?? null,
    label: clip(input.label, 60),
  });
  return true;
}

export async function recordVital(
  db: Database,
  input: {
    name: string;
    value: number;
    path: string;
    userAgent: string | null;
    width: number | null;
  },
  now: Date,
): Promise<boolean> {
  if (!Object.hasOwn(VITALS, input.name) || !Number.isFinite(input.value) || input.value < 0)
    return false;
  const page = pageName(input.path);
  if (!page || isBot(input.userAgent)) return false;
  const ua = parseUserAgent(input.userAgent ?? "");
  await db.insert(webVitals).values({
    at: now,
    section: page.section,
    metric: input.name as VitalName,
    value: Math.min(input.value, 600_000),
    device: ua.device === "Desktop" && input.width && input.width < 600 ? "Phone" : ua.device,
  });
  return true;
}

/** Delete page views, actions and loading times older than ANALYTICS_KEEP_MONTHS. */
export async function purgeAnalytics(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ANALYTICS_KEEP_MONTHS);
  const views = await db
    .delete(pageViews)
    .where(lt(pageViews.at, cutoff))
    .returning({ id: pageViews.id });
  await db.delete(analyticsEvents).where(lt(analyticsEvents.at, cutoff));
  await db.delete(webVitals).where(lt(webVitals.at, cutoff));
  return views.length;
}

/* Reading */

/** Perth dates, inclusive. */
export interface DateSpan {
  from: string;
  to: string;
}

/** The UTC instants a span of Perth dates covers. */
export function spanBounds(span: DateSpan): { start: Date; end: Date } {
  return {
    start: perthToUtc(span.from, "00:00"),
    end: perthToUtc(addPerthDays(span.to, 1), "00:00"),
  };
}

/** Run raw SQL on either driver (PGlite returns { rows }, postgres-js an array). */
export async function rows<T>(db: Database, query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown;
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

const n = (v: unknown) => Number(v ?? 0);
const TZ = sql.raw(`'${PERTH_TIME_ZONE}'`);
const within = (column: SQL, span: DateSpan) => {
  const { start, end } = spanBounds(span);
  return sql`${column} >= ${start.toISOString()}::timestamptz and ${column} < ${end.toISOString()}::timestamptz`;
};

export interface Totals {
  visitors: number;
  visits: number;
  views: number;
  /** Share of visits that saw one page, 0 to 1. */
  bounceRate: number;
  /** Average time on site per visit. */
  avgVisitMs: number;
  pagesPerVisit: number;
}

export async function analyticsTotals(db: Database, span: DateSpan): Promise<Totals> {
  const [row] = await rows<Record<string, unknown>>(
    db,
    sql`with v as (
          select visit_id, visitor_id, count(*) as views, sum(coalesce(duration_ms, 0)) as ms
          from page_views where ${within(sql`at`, span)} group by visit_id, visitor_id
        )
        select count(distinct visitor_id) as visitors, count(*) as visits,
          coalesce(sum(views), 0) as views,
          coalesce(avg(case when views = 1 then 1.0 else 0.0 end), 0) as bounce,
          coalesce(avg(ms), 0) as ms
        from v`,
  );
  const visits = n(row?.visits);
  return {
    visitors: n(row?.visitors),
    visits,
    views: n(row?.views),
    bounceRate: n(row?.bounce),
    avgVisitMs: Math.round(n(row?.ms)),
    pagesPerVisit: visits ? n(row?.views) / visits : 0,
  };
}

export interface SeriesPoint {
  /** "2026-10-24" for a day or week (its Monday), "2026-10-24 13" for an hour. */
  key: string;
  values: Record<string, number>;
}

/** Every bucket in the span, so quiet days show as zero. */
export function bucketKeys(span: DateSpan, bucket: "hour" | "day" | "week"): string[] {
  if (bucket === "hour")
    return Array.from({ length: 24 }, (_, h) => `${span.from} ${String(h).padStart(2, "0")}`);
  const keys: string[] = [];
  let day = span.from;
  if (bucket === "week") {
    // Back to the Monday.
    const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    day = addPerthDays(day, -dow);
  }
  for (; day <= span.to; day = addPerthDays(day, bucket === "week" ? 7 : 1)) keys.push(day);
  return keys;
}

const bucketSql = (bucket: "hour" | "day" | "week", column: SQL) =>
  bucket === "hour"
    ? sql`to_char(date_trunc('hour', timezone(${TZ}, ${column})), 'YYYY-MM-DD HH24')`
    : sql`to_char(date_trunc(${sql.raw(`'${bucket}'`)}, timezone(${TZ}, ${column})), 'YYYY-MM-DD')`;

function fill(
  keys: string[],
  found: { key: string; [name: string]: unknown }[],
  names: string[],
): SeriesPoint[] {
  const byKey = new Map(found.map((r) => [r.key, r]));
  return keys.map((key) => ({
    key,
    values: Object.fromEntries(names.map((name) => [name, n(byKey.get(key)?.[name])])),
  }));
}

/** Visitors and page views over time. */
export async function visitorSeries(
  db: Database,
  span: DateSpan,
  bucket: "hour" | "day" | "week",
): Promise<SeriesPoint[]> {
  const found = await rows<{ key: string; visitors: unknown; views: unknown }>(
    db,
    sql`select ${bucketSql(bucket, sql`at`)} as key, count(distinct visitor_id) as visitors, count(*) as views
        from page_views where ${within(sql`at`, span)} group by 1`,
  );
  return fill(bucketKeys(span, bucket), found, ["visitors", "views"]);
}

/** Who's on the site in the last five minutes, and where. */
export async function liveVisitors(db: Database, now: Date) {
  const since = new Date(now.getTime() - 5 * 60_000).toISOString();
  const pages = await rows<{ path: string; section: string; visitors: unknown }>(
    db,
    sql`select path, section, count(distinct visitor_id) as visitors from (
          select distinct on (visitor_id) visitor_id, path, section from page_views
          where at >= ${since}::timestamptz order by visitor_id, at desc
        ) latest group by path, section order by visitors desc, path limit 20`,
  );
  return {
    visitors: pages.reduce((sum, p) => sum + n(p.visitors), 0),
    pages: pages.map((p) => ({ path: p.path, section: p.section, visitors: n(p.visitors) })),
  };
}

export interface CountRow {
  label: string;
  /** A second part of the label, like a section or a region. */
  detail?: string | null;
  count: number;
  visitors?: number;
  avgMs?: number;
}

async function countBy(db: Database, query: SQL): Promise<CountRow[]> {
  const found = await rows<Record<string, unknown>>(db, query);
  return found.map((r) => ({
    label: String(r.label ?? "Unknown"),
    detail: r.detail === undefined || r.detail === null ? null : String(r.detail),
    count: n(r.count),
    ...(r.visitors !== undefined ? { visitors: n(r.visitors) } : {}),
    ...(r.avg_ms !== undefined ? { avgMs: Math.round(n(r.avg_ms)) } : {}),
  }));
}

/* Pages */

export async function pageReport(db: Database, span: DateSpan) {
  const range = within(sql`at`, span);
  return {
    pages: await countBy(
      db,
      sql`select path as label, section as detail, count(*) as count,
            count(distinct visitor_id) as visitors, coalesce(avg(duration_ms), 0) as avg_ms
          from page_views where ${range} group by path, section order by count desc, path limit 100`,
    ),
    sections: await countBy(
      db,
      sql`select section as label, count(*) as count, count(distinct visitor_id) as visitors,
            coalesce(avg(duration_ms), 0) as avg_ms
          from page_views where ${range} group by section order by count desc`,
    ),
    entries: await countBy(
      db,
      sql`select path as label, section as detail, count(*) as count
          from page_views where ${range} and entry group by path, section order by count desc, path limit 30`,
    ),
    exits: await countBy(
      db,
      sql`select path as label, section as detail, count(*) as count from (
            select distinct on (visit_id) visit_id, path, section from page_views
            where ${range} order by visit_id, at desc
          ) last_pages group by path, section order by count desc, path limit 30`,
    ),
  };
}

/* Where visitors come from */

export async function sourceReport(db: Database, span: DateSpan, bucket: "hour" | "day" | "week") {
  const range = within(sql`at`, span);
  const found = await rows<{ key: string; channel: string; visits: unknown }>(
    db,
    sql`select ${bucketSql(bucket, sql`at`)} as key, channel, count(*) as visits
        from page_views where ${range} and entry group by 1, 2`,
  );
  const channels = ["Search", "Social", "Email", "Campaign", "Other sites", "Direct"];
  const grouped = new Map<string, Record<string, unknown>>();
  for (const r of found) {
    const row = grouped.get(r.key) ?? { key: r.key };
    row[r.channel] = n(r.visits);
    grouped.set(r.key, row);
  }
  return {
    channels: await countBy(
      db,
      sql`select channel as label, count(*) as count, count(distinct visitor_id) as visitors
          from page_views where ${range} and entry group by channel order by count desc`,
    ),
    sources: await countBy(
      db,
      sql`select source as label, channel as detail, count(*) as count, count(distinct visitor_id) as visitors
          from page_views where ${range} and entry group by source, channel order by count desc limit 50`,
    ),
    campaigns: await countBy(
      db,
      sql`select coalesce(utm_campaign, '(none)') as label,
            concat_ws(' / ', utm_source, utm_medium) as detail, count(*) as count
          from page_views where ${range} and entry and (utm_campaign is not null or utm_source is not null)
          group by 1, 2 order by count desc limit 50`,
    ),
    series: fill(bucketKeys(span, bucket), [...grouped.values()] as { key: string }[], channels),
  };
}

/* Who visitors are */

export async function audienceReport(db: Database, span: DateSpan) {
  const range = within(sql`at`, span);
  const { start } = spanBounds(span);
  const [kinds] = await rows<Record<string, unknown>>(
    db,
    sql`with f as (select visitor_id, min(at) as first_at from page_views group by visitor_id)
        select count(*) filter (where first_at >= ${start.toISOString()}::timestamptz) as new_visitors,
               count(*) filter (where first_at < ${start.toISOString()}::timestamptz) as returning_visitors
        from f where visitor_id in (select visitor_id from page_views where ${range})`,
  );
  const [flags] = await rows<Record<string, unknown>>(
    db,
    sql`with v as (select visit_id, bool_or(app) as app, bool_or(signed_in) as signed_in
          from page_views where ${range} group by visit_id)
        select count(*) as visits, count(*) filter (where app) as app,
               count(*) filter (where signed_in) as signed_in from v`,
  );
  return {
    newVisitors: n(kinds?.new_visitors),
    returningVisitors: n(kinds?.returning_visitors),
    visits: n(flags?.visits),
    appVisits: n(flags?.app),
    signedInVisits: n(flags?.signed_in),
    devices: await countBy(
      db,
      sql`select device as label, count(*) as count from page_views where ${range} and entry
          group by device order by count desc`,
    ),
    browsers: await countBy(
      db,
      sql`select browser as label, count(*) as count from page_views where ${range} and entry
          group by browser order by count desc`,
    ),
    systems: await countBy(
      db,
      sql`select os as label, count(*) as count from page_views where ${range} and entry
          group by os order by count desc`,
    ),
    places: await countBy(
      db,
      sql`select coalesce(city, 'Unknown') as label, concat_ws(', ', region, country) as detail, count(*) as count
          from page_views where ${range} and entry group by 1, 2 order by count desc limit 50`,
    ),
  };
}

export interface Cohort {
  /** The Monday of the week they first came. */
  week: string;
  visitors: number;
  /** How many came back in each week after, from week 0 (the first week, everyone). */
  returned: number[];
}

/** Visitors grouped by the week they first came, and how many came back each week after. */
export async function returnCohorts(db: Database, today: string, weeks = 8): Promise<Cohort[]> {
  const keys = bucketKeys({ from: addPerthDays(today, -(weeks - 1) * 7), to: today }, "week");
  const found = await rows<{ week: string; offset: unknown; visitors: unknown }>(
    db,
    sql`with first as (
          select visitor_id, date_trunc('week', timezone(${TZ}, min(at))) as w0
          from page_views group by visitor_id
        ), active as (
          select distinct visitor_id, date_trunc('week', timezone(${TZ}, at)) as w from page_views
        )
        select to_char(first.w0, 'YYYY-MM-DD') as week,
               (extract(epoch from active.w - first.w0) / 604800)::int as offset,
               count(*) as visitors
        from first join active using (visitor_id)
        where first.w0 >= ${keys[0]}::timestamp
        group by 1, 2`,
  );
  return keys.map((week, i) => {
    const mine = found.filter((r) => r.week === week);
    const visitors = n(mine.find((r) => n(r.offset) === 0)?.visitors);
    return {
      week,
      visitors,
      returned: Array.from({ length: weeks - i }, (_, k) =>
        n(mine.find((r) => n(r.offset) === k)?.visitors),
      ),
    };
  });
}

/* Tee times */

export async function teeTimeReport(db: Database, span: DateSpan, bucket: "hour" | "day" | "week") {
  const views = within(sql`at`, span);
  const made = within(sql`created_at`, span);
  const [funnel] = await rows<Record<string, unknown>>(
    db,
    sql`select
          (select count(distinct visitor_id) from page_views where ${views}) as visitors,
          (select count(distinct anonymous_session_id) from searches where ${made}) as searchers,
          (select count(distinct anonymous_session_id) from click_events where ${made}
             and source in ('search', 'directory', 'share')) as clickers,
          (select count(*) from searches where ${made}) as searches,
          (select count(*) from searches where ${made} and result_count = 0) as empty_searches,
          (select count(*) from click_events where ${made}) as clicks`,
  );
  const series = await rows<{ key: string; searches: unknown; clicks: unknown }>(
    db,
    sql`select key, sum(searches) as searches, sum(clicks) as clicks from (
          select ${bucketSql(bucket, sql`created_at`)} as key, 1 as searches, 0 as clicks from searches where ${made}
          union all
          select ${bucketSql(bucket, sql`created_at`)}, 0, 1 from click_events where ${made}
        ) both_kinds group by key`,
  );
  const grid = await rows<{ dow: unknown; hour: unknown; count: unknown }>(
    db,
    sql`select extract(isodow from date_from) as dow, extract(hour from time_from) as hour, count(*) as count
        from searches where ${made} group by 1, 2`,
  );
  return {
    visitors: n(funnel?.visitors),
    searchers: n(funnel?.searchers),
    clickers: n(funnel?.clickers),
    searches: n(funnel?.searches),
    emptySearches: n(funnel?.empty_searches),
    clicks: n(funnel?.clicks),
    series: fill(bucketKeys(span, bucket), series, ["searches", "clicks"]),
    /** Searches by the day (1 Monday … 7 Sunday) and hour of the tee time wanted. */
    grid: grid.map((g) => ({ dow: n(g.dow), hour: n(g.hour), count: n(g.count) })),
    players: await countBy(
      db,
      sql`select players::text as label, count(*) as count from searches where ${made}
          group by players order by players`,
    ),
    holes: await countBy(
      db,
      sql`select coalesce(holes::text, 'Any') as label, count(*) as count from searches where ${made}
          group by 1 order by 1`,
    ),
    leadTime: await countBy(
      db,
      sql`select case
            when date_from - timezone(${TZ}, created_at)::date <= 0 then 'Today'
            when date_from - timezone(${TZ}, created_at)::date = 1 then 'Tomorrow'
            when date_from - timezone(${TZ}, created_at)::date <= 3 then '2 to 3 days ahead'
            when date_from - timezone(${TZ}, created_at)::date <= 7 then '4 to 7 days ahead'
            else 'Over a week ahead' end as label, count(*) as count
          from searches where ${made} group by 1 order by min(date_from - timezone(${TZ}, created_at)::date)`,
    ),
    actions: await countBy(
      db,
      sql`select name as label, label as detail, count(*) as count from analytics_events
          where ${views} and name in ('sort', 'filter', 'near_me', 'tee_sheet_day')
          group by name, label order by count desc`,
    ),
    courses: await courseFunnel(db, span),
    alerts: await alertReport(db, span),
  };
}

/** Each course: shown in results, course page views, and clicks to the club. */
async function courseFunnel(db: Database, span: DateSpan) {
  const found = await rows<Record<string, unknown>>(
    db,
    sql`select c.name, c.slug,
          coalesce((select sum(impressions) from daily_impressions d
            where d.course_id = c.id and d.day between ${span.from}::date and ${span.to}::date), 0) as shown,
          (select count(*) from page_views p where p.path = '/courses/' || c.slug and ${within(sql`p.at`, span)}) as views,
          (select count(*) from click_events e where e.course_id = c.id and ${within(sql`e.created_at`, span)}) as clicks
        from courses c where c.enabled`,
  );
  return found
    .map((r) => ({
      name: String(r.name),
      slug: String(r.slug),
      shown: n(r.shown),
      views: n(r.views),
      clicks: n(r.clicks),
    }))
    .filter((c) => c.shown + c.views + c.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks || b.shown - a.shown || a.name.localeCompare(b.name));
}

async function alertReport(db: Database, span: DateSpan) {
  const [row] = await rows<Record<string, unknown>>(
    db,
    sql`select
          (select count(*) from alerts where ${within(sql`created_at`, span)}) as created,
          (select count(*) from alerts where ${within(sql`confirmed_at`, span)}) as confirmed,
          (select count(*) from notifications where not baseline and ${within(sql`sent_at`, span)}) as sent,
          (select count(*) from click_events where source = 'alert' and ${within(sql`created_at`, span)}) as clicks`,
  );
  return {
    created: n(row?.created),
    confirmed: n(row?.confirmed),
    sent: n(row?.sent),
    clicks: n(row?.clicks),
  };
}

/* Coaching, events and match play */

export interface FunnelStep {
  label: string;
  count: number;
}

export async function bookingFunnels(db: Database, span: DateSpan) {
  const views = within(sql`at`, span);
  const made = within(sql`created_at`, span);
  const [r] = await rows<Record<string, unknown>>(
    db,
    sql`select
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Find a coach') as directory,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Coach page') as coach_page,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Lesson booking') as book_page,
          (select count(*) from lesson_bookings where ${made}) as lesson_started,
          (select count(*) from lesson_bookings where ${made} and status not in ('checkout', 'abandoned')) as lesson_paid,
          (select count(*) from lesson_bookings where ${made} and status = 'confirmed') as lesson_confirmed,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Group session') as group_page,
          (select count(*) from group_bookings where ${made}) as group_started,
          (select count(*) from group_bookings where ${made} and status in ('paid', 'cancelled')) as group_paid,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Competitions') as comps_page,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Event page') as event_page,
          (select count(*) from event_entries where ${made}) as event_started,
          (select count(*) from event_entries where ${made} and status in ('paid', 'withdrawn', 'cancelled')) as event_paid,
          (select count(distinct visitor_id) from page_views where ${views} and section = 'Match play') as mp_page,
          (select count(*) from matchplay_entries where ${made} and source = 'online') as mp_started,
          (select count(*) from matchplay_entries where ${made} and source = 'online'
             and status in ('entered', 'withdrawn', 'cancelled')) as mp_entered`,
  );
  const step = (label: string, key: string): FunnelStep => ({ label, count: n(r?.[key]) });
  return {
    lessons: [
      step("Visited Find a coach", "directory"),
      step("Viewed a coach's page", "coach_page"),
      step("Opened lesson booking", "book_page"),
      step("Went to pay", "lesson_started"),
      step("Paid (card held)", "lesson_paid"),
      step("Confirmed by the coach", "lesson_confirmed"),
    ],
    groups: [
      step("Viewed a group session", "group_page"),
      step("Went to pay", "group_started"),
      step("Paid", "group_paid"),
    ],
    events: [
      step("Visited Competitions", "comps_page"),
      step("Viewed an event", "event_page"),
      step("Went to pay", "event_started"),
      step("Entered", "event_paid"),
    ],
    matchplay: [
      step("Viewed a match play competition", "mp_page"),
      step("Started an entry", "mp_started"),
      step("Entered", "mp_entered"),
    ],
    coachContacts: await countBy(
      db,
      sql`select method as label, count(*) as count from coach_contacts
          where ${within(sql`at`, span)} group by method order by count desc`,
    ),
  };
}

/* Accounts */

export async function accountReport(db: Database, span: DateSpan, bucket: "hour" | "day" | "week") {
  const made = within(sql`created_at`, span);
  const [r] = await rows<Record<string, unknown>>(
    db,
    sql`select
          (select count(*) from users where ${made}) as signups,
          (select count(*) from user_sessions where ${made}) as sign_ins,
          (select count(*) from favourites where ${made}) as favourites,
          (select count(*) from course_ratings where ${made}) as ratings,
          (select count(*) from alerts where ${made}) as alerts,
          (select count(*) from analytics_events where ${within(sql`at`, span)} and name = 'share') as shares,
          (select count(*) from analytics_events where ${within(sql`at`, span)} and name = 'install') as installs,
          (select count(*) from analytics_events where ${within(sql`at`, span)} and name = 'install_prompt') as prompts`,
  );
  const series = await rows<{ key: string; signups: unknown; sign_ins: unknown }>(
    db,
    sql`select key, sum(signups) as signups, sum(sign_ins) as sign_ins from (
          select ${bucketSql(bucket, sql`created_at`)} as key, 1 as signups, 0 as sign_ins from users where ${made}
          union all
          select ${bucketSql(bucket, sql`created_at`)}, 0, 1 from user_sessions where ${made}
        ) both_kinds group by key`,
  );
  return {
    signups: n(r?.signups),
    signIns: n(r?.sign_ins),
    favourites: n(r?.favourites),
    ratings: n(r?.ratings),
    alerts: n(r?.alerts),
    shares: n(r?.shares),
    installs: n(r?.installs),
    installPrompts: n(r?.prompts),
    series: fill(
      bucketKeys(span, bucket),
      series.map((s) => ({ key: s.key, signups: s.signups, signIns: s.sign_ins })),
      ["signups", "signIns"],
    ),
  };
}

/* Speed */

export interface VitalRow {
  metric: VitalName;
  /** "All", or a device, or a section. */
  group: string;
  /** The 75th percentile, as Google measures it. */
  p75: number;
  samples: number;
}

export async function speedReport(db: Database, span: DateSpan) {
  const range = within(sql`at`, span);
  const read = async (query: SQL) =>
    (await rows<Record<string, unknown>>(db, query)).map((r): VitalRow => ({
      metric: String(r.metric) as VitalName,
      group: String(r.grp),
      p75: n(r.p75),
      samples: n(r.samples),
    }));
  return {
    overall: await read(
      sql`select metric, 'All' as grp, percentile_cont(0.75) within group (order by value) as p75,
            count(*) as samples from web_vitals where ${range} group by metric`,
    ),
    byDevice: await read(
      sql`select metric, device as grp, percentile_cont(0.75) within group (order by value) as p75,
            count(*) as samples from web_vitals where ${range} group by metric, device`,
    ),
    bySection: await read(
      sql`select metric, section as grp, percentile_cont(0.75) within group (order by value) as p75,
            count(*) as samples from web_vitals where ${range} group by metric, section`,
    ),
  };
}

/** Recent page views, for checking the tracker works. */
export function recentPageViews(db: Database, since: Date) {
  return db
    .select()
    .from(pageViews)
    .where(gte(pageViews.at, since))
    .orderBy(desc(pageViews.at))
    .limit(50);
}

/* The Monday summary email */

export interface AnalyticsSettings {
  /** Email the admin a summary of last week every Monday morning. */
  weeklyEmail: boolean;
}

export async function analyticsSettings(db: Database): Promise<AnalyticsSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "analytics"));
  const value = (row?.value ?? {}) as Partial<AnalyticsSettings>;
  return { weeklyEmail: value.weeklyEmail ?? true };
}

export async function setAnalyticsSettings(
  db: Database,
  settings: AnalyticsSettings,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "analytics", value: settings, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: settings, updatedAt: now } });
  await logChange(
    db,
    actor,
    { action: "Changed analytics settings", details: { ...settings } },
    now,
  );
}

/**
 * Claim the summary for a week (its Monday), so it's sent once even if the
 * worker runs twice. Returns false if it was already claimed.
 */
export async function claimWeeklySummary(db: Database, week: string, now: Date): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "analytics_weekly_sent"));
  if ((row?.value as { week?: string } | undefined)?.week === week) return false;
  await db
    .insert(appSettings)
    .values({ key: "analytics_weekly_sent", value: { week }, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { week }, updatedAt: now } });
  return true;
}

export interface WeeklySummary {
  span: DateSpan;
  totals: Totals;
  previous: Totals;
  searches: number;
  previousSearches: number;
  clicks: number;
  previousClicks: number;
  /** Share of visitors who clicked through to a club, 0 to 1. */
  clickThrough: number;
  topCourses: { name: string; clicks: number }[];
  topChannels: { label: string; count: number }[];
  topPages: { label: string; count: number }[];
  signups: number;
  alerts: number;
}

export async function weeklySummary(db: Database, span: DateSpan): Promise<WeeklySummary> {
  const days = Math.round(
    (spanBounds(span).end.getTime() - spanBounds(span).start.getTime()) / 86_400_000,
  );
  const previousSpan = { from: addPerthDays(span.from, -days), to: addPerthDays(span.from, -1) };
  const totals = await analyticsTotals(db, span);
  const previous = await analyticsTotals(db, previousSpan);
  const tee = await teeTimeReport(db, span, "day");
  const teeBefore = await teeTimeReport(db, previousSpan, "day");
  const sources = await sourceReport(db, span, "day");
  const pages = await pageReport(db, span);
  const accounts = await accountReport(db, span, "day");
  return {
    span,
    totals,
    previous,
    searches: tee.searches,
    previousSearches: teeBefore.searches,
    clicks: tee.clicks,
    previousClicks: teeBefore.clicks,
    clickThrough: tee.visitors ? tee.clickers / tee.visitors : 0,
    topCourses: tee.courses
      .filter((c) => c.clicks > 0)
      .slice(0, 3)
      .map((c) => ({ name: c.name, clicks: c.clicks })),
    topChannels: sources.channels.slice(0, 3).map((c) => ({ label: c.label, count: c.count })),
    topPages: pages.sections.slice(0, 3).map((p) => ({ label: p.label, count: p.count })),
    signups: accounts.signups,
    alerts: tee.alerts.created,
  };
}
