import {
  eachPerthDate,
  perthToUtc,
  type Course,
  type CourseAdapter,
  type DayAvailability,
  type FetchContext,
  type TeeTime,
} from "@bookon/core";
import { ConfigError, PageFormatError } from "../shared";

/**
 * Your Golf Booking (yourgolfbooking.com), used by golf simulator venues and
 * driving ranges. Approved by the owner on 18 October 2026; see docs/platforms.md.
 *
 * Each bookable group ("Simulators", "Driving Range") has a public page whose
 * embedded data holds its opening hours, bays and session options. A public
 * API lists the day's bookings as bay, start and end only. The booking page
 * works out free bays from exactly these, and so does this adapter, as a
 * member of the public (no membership perks).
 */

export const YGB_SITE = "https://yourgolfbooking.com";
export const YGB_API = "https://api.yourgolfbooking.com";

/** Session lengths BookOn offers, in minutes. */
export const SESSION_MINUTES = [30, 60, 90, 120] as const;

export interface YgbConfig {
  /** The venue's slug, e.g. "outta-bounds". */
  venue: string;
  /** The bookable group's slug, e.g. "simulators" or "bays". */
  group: string;
  /** Only these bays, by the venue's reference (e.g. ["1", "2"]), when the group mixes in darts or pool. */
  bays?: string[];
}

export function ygbConfig(course: Pick<Course, "platformConfig" | "slug">): YgbConfig {
  const c = course.platformConfig;
  if (typeof c.venue !== "string" || typeof c.group !== "string")
    throw new ConfigError(`${course.slug}: platformConfig needs "venue" and "group"`);
  const bays = Array.isArray(c.bays) ? c.bays.map(String) : undefined;
  return { venue: c.venue, group: c.group, ...(bays ? { bays } : {}) };
}

export function ygbGroupUrl(config: Pick<YgbConfig, "venue" | "group">): string {
  return `${YGB_SITE}/venues/${encodeURIComponent(config.venue)}/booking/${encodeURIComponent(config.group)}`;
}

export function ygbBookingsUrl(venue: string, date: string): string {
  const params = new URLSearchParams({
    start_gte: `${date}T00:00:00+08:00`,
    start_lte: `${date}T23:59:59+08:00`,
  });
  return `${YGB_API}/venue/${encodeURIComponent(venue)}/bookings/public?${params}`;
}

/* ---------- The group page ---------- */

interface Rule {
  __component: string;
  [key: string]: unknown;
}

export interface Restriction {
  type: string;
  appliedFlags: number[];
  rules: Rule[];
}

/** Per weekday ("Mo"…"Su"): from which minute of the day the option is "unavailable" or costs this many cents a slot. */
type DaySchedule = Record<string, Record<string, number | "unavailable">>;

export interface SessionOption {
  id: number;
  name: string;
  /** Minutes this option can run for. */
  minutes: number[];
  minPlayers: number;
  maxPlayers: number;
  appliedFlags: number[];
  rules: Rule[];
  /** "fixed": one price for the whole session. "slot": priced per slot, from the schedule. */
  durationType: "fixed" | "slot";
  priceCents: number;
  /** Date-ranged schedules; one with no dates is the default. */
  schedules: { from: string | null; to: string | null; days: DaySchedule }[];
  /** True when the price also depends on the players (per-player charges), so it isn't shown. */
  pricedPerPlayer: boolean;
}

export interface Bay {
  id: number;
  ref: string;
  label: string;
  options: number[];
  /** Times the venue has closed the bay, or opened it again. */
  restrictedTimes: Rule[];
}

export interface GroupPage {
  venueName: string;
  timezone: string;
  rangeName: string;
  slotMinutes: number;
  intervalMinutes: number;
  maxPlayers: number;
  maxAheadMinutes: number;
  openingHours: string;
  bays: Bay[];
  options: Map<number, SessionOption>;
  restrictions: Restriction[];
}

const UNIT_MINUTES: Record<string, number> = {
  minute: 1,
  hour: 60,
  day: 1440,
  week: 10080,
  month: 43200,
};

function aheadMinutes(value: unknown, unit: unknown): number {
  const per = UNIT_MINUTES[String(unit)];
  if (typeof value !== "number" || !per)
    throw new PageFormatError(`Unknown booking window ${value} ${unit}`);
  return value * per;
}

/**
 * Options that aren't a member of the public hiring a bay: member vouchers,
 * coaching, and the darts and pool some venues book alongside. "Non member"
 * hire is public.
 */
function notBayHire(name: string): boolean {
  return (
    /\b(members?|coaching|lessons?|voucher|darts|pool)\b/i.test(name) &&
    !/\bnon[- ]?members?\b(?!.*\b(darts|pool)\b)/i.test(name)
  );
}

/** Read a group page. Throws PageFormatError if it isn't the Your Golf Booking page we expect. */
export function parseGroupPage(html: string, config: YgbConfig): GroupPage {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!match) throw new PageFormatError("No page data: not a Your Golf Booking page");
  let state: Record<string, any>;
  try {
    state = JSON.parse(match[1]!).props.pageProps.initialReduxState;
  } catch {
    throw new PageFormatError("Page data couldn't be read");
  }
  const venue = state?.venue;
  const range = (state?.ranges?.items ?? []).find((r: any) => r.slug === config.group);
  if (!venue?.name || !range)
    throw new PageFormatError(`No bookable group "${config.group}" on the page`);
  if (!["Australia/Perth", "Australia/West"].includes(venue.timezone))
    throw new PageFormatError(`Venue isn't on Perth time (${venue.timezone})`);
  const slotMinutes = Number(range.slotDuration);
  if (!(slotMinutes > 0)) throw new PageFormatError("No slot length");

  const options = new Map<number, SessionOption>();
  for (const o of state.bays?.bayOptions ?? []) {
    // Only what a member of the public can book.
    if (o.adminOnly || o.disabled || o.hidden) continue;
    if ((o.appliedRequiredPerks ?? []).length > 0) continue;
    if (notBayHire(String(o.name))) continue;
    const slots: number[] =
      o.durationType === "slot"
        ? Array.from(
            { length: Math.max(0, (o.maxBookingDuration ?? 1) - (o.minBookingDuration ?? 1) + 1) },
            (_, i) => (o.minBookingDuration ?? 1) + i,
          )
        : [Number(o.duration)];
    options.set(o.id, {
      id: o.id,
      name: String(o.name),
      minutes: slots.filter((n) => n > 0).map((n) => n * slotMinutes),
      minPlayers: Number(o.minPlayers ?? 1),
      maxPlayers: Number(o.maxPlayers ?? range.maxPlayers),
      appliedFlags: o.appliedFlags ?? [],
      rules: o.restrictions ?? [],
      durationType: o.durationType === "slot" ? "slot" : "fixed",
      priceCents: Number(o.price) || 0,
      schedules: (o.slotSchedules ?? []).map((sch: any) => ({
        from: sch.from ?? null,
        to: sch.to ?? null,
        days: sch.schedule ?? {},
      })),
      pricedPerPlayer: (o.purchaseOptions ?? []).some((p: any) => Number(p.price) > 0),
    });
  }

  const wanted = config.bays ? new Set(config.bays) : null;
  const bays: Bay[] = (state.bays?.items ?? [])
    .filter(
      (b: any) => b.range === range.id && b.bookable && (!wanted || wanted.has(String(b.ref))),
    )
    .map((b: any) => ({
      id: b.id,
      ref: String(b.ref),
      label: String(b.label ?? b.ref),
      options: (b.options ?? []).filter((id: number) => options.has(id)),
      restrictedTimes: b.restrictedTimes ?? [],
    }))
    .filter((b: Bay) => b.options.length > 0);
  if (wanted && bays.length < wanted.size)
    throw new PageFormatError(`Bays ${[...wanted].join(", ")} aren't all bookable on the page`);
  if (bays.length === 0) throw new PageFormatError("No bays the public can book");

  return {
    venueName: venue.name,
    timezone: venue.timezone,
    rangeName: range.name,
    slotMinutes,
    intervalMinutes: Number(range.slotInterval) || slotMinutes,
    maxPlayers: Number(range.maxPlayers),
    maxAheadMinutes: aheadMinutes(range.maxBookAheadValue, range.maxBookAheadUnit),
    openingHours: String(range.openingHours ?? ""),
    bays,
    options,
    restrictions: (venue.restrictions ?? []).filter((r: any) => r.type === "bayOption"),
  };
}

/* ---------- Opening hours ---------- */

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Minutes after midnight for "HH:MM" or "HH:MM:SS.mmm". */
function minutesOf(time: string): number {
  const m = /^(\d{2}):(\d{2})/.exec(time);
  if (!m) throw new PageFormatError(`Bad time "${time}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export interface Span {
  from: number;
  to: number;
}

/**
 * The opening hours for one Perth date, from a group's opening hours text,
 * e.g. "Mo 09:00-21:00 open;Tu open;2025 Dec 25 off;2025 Dec 29-2025 Dec 30 12:00-20:00 open".
 * Later rules win, so a date's own rule replaces its weekday's.
 */
export function hoursOn(text: string, date: string): Span[] {
  let spans: Span[] = [];
  for (const raw of text.split(";")) {
    const rule = raw.trim();
    if (!rule) continue;
    const dated =
      /^(\d{4}) ([A-Z][a-z]{2}) (\d{2})(?:-(\d{4}) ([A-Z][a-z]{2}) (\d{2}))?(?:\s+(.*))?$/.exec(
        rule,
      );
    const weekly = /^([A-Z][a-z](?:[-,][A-Z][a-z])*)(?:\s+(.*))?$/.exec(rule);
    let applies: boolean;
    let rest: string;
    if (dated) {
      const iso = (y: string, mon: string, d: string) => {
        const m = MONTHS.indexOf(mon);
        if (m < 0) throw new PageFormatError(`Bad month in "${rule}"`);
        return `${y}-${String(m + 1).padStart(2, "0")}-${d}`;
      };
      const from = iso(dated[1]!, dated[2]!, dated[3]!);
      const to = dated[4] ? iso(dated[4], dated[5]!, dated[6]!) : from;
      applies = date >= from && date <= to;
      rest = dated[7] ?? "";
    } else if (weekly && weekly[1]!.split(/[-,]/).every((d) => DAYS.includes(d))) {
      const day = DAYS[weekday(date)]!;
      applies = weekly[1]!.split(",").some((part) => {
        const [a, b] = part.split("-");
        if (!b) return a === day;
        // Mo-Fr, wrapping round the week if needed.
        const i = DAYS.indexOf(a!),
          j = DAYS.indexOf(b),
          k = DAYS.indexOf(day);
        return i <= j ? k >= i && k <= j : k >= i || k <= j;
      });
      rest = weekly[2] ?? "";
    } else {
      throw new PageFormatError(`Opening hours rule not understood: "${rule}"`);
    }
    if (!applies) continue;
    const words = rest.trim().split(/\s+/).filter(Boolean);
    const state = words.find((w) => /^(open|off|closed)$/.test(w)) ?? "open";
    const times = words.filter((w) =>
      /^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2})*$/.test(w),
    );
    if (words.length !== times.length + (words.some((w) => /^(open|off|closed)$/.test(w)) ? 1 : 0))
      throw new PageFormatError(`Opening hours rule not understood: "${rule}"`);
    if (state !== "open") {
      spans = [];
    } else if (times.length === 0) {
      spans = [{ from: 0, to: 24 * 60 }];
    } else {
      spans = times
        .flatMap((t) => t.split(","))
        .map((t) => {
          const [a, b] = t.split("-");
          const from = minutesOf(a!);
          let to = minutesOf(b!);
          // Past midnight ("18:00-02:00") is cut at midnight; the next day has its own rule.
          if (to <= from) to = 24 * 60;
          return { from, to };
        });
    }
  }
  return spans;
}

/* ---------- Session option rules ---------- */

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface When {
  date: string;
  /** Minutes after midnight, Perth time. */
  minute: number;
  start: Date;
  now: Date;
}

/** Whether one rule lets a member of the public book this start. */
export function rulePasses(rule: Rule, when: When): boolean {
  const inTimes = (times: unknown) =>
    (times as { day: string; fromTime: string; toTime: string }[]).some(
      (t) =>
        t.day === DAY_CODES[weekday(when.date)] &&
        when.minute >= minutesOf(t.fromTime) &&
        when.minute < minutesOf(t.toTime),
    );
  const onDates = () => {
    const dates = (rule.dates as string[] | null) ?? (rule.date ? [String(rule.date)] : []);
    if (!dates.includes(when.date)) return false;
    if (rule.fromTime && when.minute < minutesOf(String(rule.fromTime))) return false;
    if (rule.toTime && when.minute >= minutesOf(String(rule.toTime))) return false;
    return true;
  };
  const ahead = (value: unknown, unit: unknown) =>
    (when.start.getTime() - when.now.getTime()) / 60000 - aheadMinutes(value, unit);
  switch (rule.__component) {
    case "restriction.requires-day-of-week-times":
      return inTimes(rule.times);
    case "restriction.not-requires-day-of-week-times":
      return !inTimes(rule.times);
    case "restriction.requires-date":
      return onDates();
    case "restriction.not-requires-date":
      return !onDates();
    case "restriction.available-from-to-date":
      return (
        (!rule.fromDate || when.start >= new Date(String(rule.fromDate))) &&
        (!rule.toDate || when.start <= new Date(String(rule.toDate)))
      );
    case "restriction.requires-perk":
      return false;
    case "restriction.max-book-ahead":
    case "restriction.max-book-ahead-if-no-perk":
      return ahead(rule.maxBookAheadValue, rule.maxBookAheadUnit) <= 0;
    case "restriction.min-book-ahead-if-not-perk":
      return ahead(rule.minBookAheadValue, rule.minBookAheadUnit) >= 0;
    // For members, or limits per customer: they don't decide whether a time is free.
    case "restriction.not-requires-perk":
    case "restriction.min-book-ahead-if-perk":
    case "restriction.max-in-calendar-period":
    case "restriction.max-in-rolling-days":
      return true;
    default:
      // Something new: don't guess that it's bookable.
      return false;
  }
}

const SCHEDULE_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * The option's schedule for one slot: "unavailable", its price in cents, or
 * undefined when the option has no schedule. A date-ranged schedule beats the
 * default one, and within a day the latest change at or before the slot applies.
 */
export function scheduleAt(
  option: SessionOption,
  date: string,
  minute: number,
): number | "unavailable" | undefined {
  const schedule =
    option.schedules.find((s) => s.from && s.to && s.from <= date && date <= s.to) ??
    option.schedules.find((s) => !s.from && !s.to);
  const day = schedule?.days[SCHEDULE_DAYS[weekday(date)]!];
  if (!day) return schedule ? "unavailable" : undefined;
  const at = Object.keys(day)
    .map(Number)
    .filter((m) => m <= minute)
    .sort((a, b) => b - a)[0];
  return at === undefined ? "unavailable" : day[String(at)];
}

/**
 * Whether this option can run for `minutes` from this start, and its price
 * for the bay when that's known (null when it also depends on the players).
 */
export function optionSession(
  page: GroupPage,
  option: SessionOption,
  when: When,
  minutes: number,
): { priceCents: number | null } | null {
  if (!option.minutes.includes(minutes) || !optionAllowed(page, option, when)) return null;
  let slotTotal = 0;
  for (let m = when.minute; m < when.minute + minutes; m += page.slotMinutes) {
    const at = scheduleAt(option, when.date, m);
    if (at === "unavailable") return null;
    slotTotal += typeof at === "number" ? at : option.priceCents;
  }
  if (option.pricedPerPlayer) return { priceCents: null };
  return { priceCents: option.durationType === "slot" ? slotTotal : option.priceCents };
}

export function optionAllowed(page: GroupPage, option: SessionOption, when: When): boolean {
  const flags = new Set(option.appliedFlags);
  const rules = [
    ...option.rules,
    ...page.restrictions
      .filter((r) => r.appliedFlags.some((f) => flags.has(f)))
      .flatMap((r) => r.rules),
  ];
  return rules.every((rule) => rulePasses(rule, when));
}

/**
 * Whether a bay is open to the public at this time. A "closed" range shuts
 * it, and an "open" range opens it again within one. On their own, "open"
 * ranges change nothing: Lights Out's bay 2 has "open 5 pm to 9 pm" ranges
 * on weekdays, and its booking page still offers it all day.
 */
function bayOpen(bay: Bay, date: string, minute: number): boolean {
  const within = (t: Rule) =>
    t.day === DAY_CODES[weekday(date)] &&
    minute >= minutesOf(String(t.fromTime)) &&
    minute < minutesOf(String(t.toTime));
  const closed = bay.restrictedTimes.some((t) => t.effect !== "open" && within(t));
  return !closed || bay.restrictedTimes.some((t) => t.effect === "open" && within(t));
}

/* ---------- Free bays ---------- */

export interface PublicBooking {
  bayId: number;
  start: string;
  end: string;
  status?: string;
}

export function parseBookings(text: string): PublicBooking[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PageFormatError("Bookings weren't JSON");
  }
  if (!Array.isArray(data)) throw new PageFormatError("Bookings weren't a list");
  return data.map((b) => {
    if (typeof b?.bayId !== "number" || typeof b?.start !== "string" || typeof b?.end !== "string")
      throw new PageFormatError("A booking was missing its bay or times");
    return { bayId: b.bayId, start: b.start, end: b.end, status: b.status };
  });
}

/**
 * The free bays on one Perth date: one entry per bay and start time, with the
 * session lengths that can start then and, when known, the cheapest price for
 * an hour in that bay (`priceCents`). Starts already passed are left out.
 */
export function freeBays(
  page: GroupPage,
  bookings: PublicBooking[],
  courseId: string,
  date: string,
  now: Date,
  bookingUrl: string,
): TeeTime[] {
  const taken = bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => ({ bayId: b.bayId, start: Date.parse(b.start), end: Date.parse(b.end) }));
  const latest = now.getTime() + page.maxAheadMinutes * 60000;
  const out: TeeTime[] = [];
  for (const span of hoursOn(page.openingHours, date)) {
    for (let minute = span.from; minute < span.to; minute += page.intervalMinutes) {
      const hhmm = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = perthToUtc(date, hhmm);
      if (start <= now || start.getTime() > latest) continue;
      const when = { date, minute, start, now };
      for (const bay of page.bays) {
        if (!bayOpen(bay, date, minute)) continue;
        const free = (m: number) => {
          const end = start.getTime() + m * 60000;
          return (
            minute + m <= span.to &&
            !taken.some((t) => t.bayId === bay.id && t.start < end && t.end > start.getTime())
          );
        };
        const durations: number[] = [];
        let minPlayers = Infinity;
        // Cheapest known price for an hour in this bay, for "$40 an hour". A group's price
        // when there is one, rather than a deal for one player.
        let hourCents: number | null = null;
        let soloHourCents: number | null = null;
        for (const m of SESSION_MINUTES) {
          if (!free(m)) continue;
          for (const id of bay.options) {
            const option = page.options.get(id)!;
            const session = optionSession(page, option, when, m);
            if (!session) continue;
            if (!durations.includes(m)) durations.push(m);
            minPlayers = Math.min(minPlayers, option.minPlayers);
            if (m === 60 && session.priceCents !== null && session.priceCents > 0) {
              if (option.maxPlayers >= 2)
                hourCents = Math.min(hourCents ?? Infinity, session.priceCents);
              else soloHourCents = Math.min(soloHourCents ?? Infinity, session.priceCents);
            }
          }
        }
        if (durations.length === 0) continue;
        out.push({
          courseId,
          startTime: start,
          holes: 0,
          layout: null,
          bay: bay.label,
          durations,
          spotsAvailable: page.maxPlayers,
          minPlayers: Number.isFinite(minPlayers) ? minPlayers : 1,
          priceCents: hourCents ?? soloHourCents,
          sourceUrl: bookingUrl,
          bookingUrl,
        });
      }
    }
  }
  return out;
}

export const ygbAdapter: CourseAdapter = {
  platform: "ygb",

  async fetchAvailability(course, range, ctx: FetchContext): Promise<DayAvailability[]> {
    const config = ygbConfig(course);
    const now = ctx.now ?? new Date();
    const pageUrl = ygbGroupUrl(config);
    const page = parseGroupPage(await ctx.http.getText(pageUrl), config);
    const lastStart = new Date(now.getTime() + page.maxAheadMinutes * 60000);
    const days: DayAvailability[] = [];
    for (const date of eachPerthDate(range.from, range.to)) {
      // Past the venue's booking window, nothing can be booked, so don't ask.
      if (perthToUtc(date, "00:00") > lastStart) break;
      const hours = hoursOn(page.openingHours, date);
      const bookings =
        hours.length === 0
          ? []
          : parseBookings(await ctx.http.getText(ygbBookingsUrl(config.venue, date)));
      days.push({ date, teeTimes: freeBays(page, bookings, course.id, date, now, pageUrl) });
    }
    return days;
  },

  buildBookingUrl(course) {
    return ygbGroupUrl(ygbConfig(course));
  },
};
