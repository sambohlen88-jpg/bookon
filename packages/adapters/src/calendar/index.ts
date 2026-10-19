import ICAL from "ical.js";
import { BOOKON_UID_SUFFIX, perthToUtc, zonedToUtc } from "@bookon/core";

/**
 * Reading a coach's own calendar for busy times (Milestone 16). The coach
 * pastes their calendar's private link (Google's "secret address in iCal
 * format", an iCloud shared calendar, or Outlook's published calendar) and
 * BookOn reads it the way a calendar app does. Only start and end times are
 * kept, never what an event is.
 */

export interface BusyTime {
  start: Date;
  end: Date;
}

/** Something wrong with the coach's link or calendar; the message is for the coach. */
export class CalendarReadError extends Error {}

/** Only the big calendar services, so a pasted link can never point the worker anywhere else. */
const CALENDAR_HOSTS = [
  /^calendar\.google\.com$/,
  /^([a-z0-9-]+\.)*icloud\.com$/,
  /^outlook\.(office365|office|live)\.com$/,
];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BUSY = 2000;

function allowedHost(url: URL): boolean {
  return CALENDAR_HOSTS.some((h) => h.test(url.hostname.toLowerCase()));
}

/** Tidy a pasted link (webcal:// becomes https://), or say what's wrong with it. */
export function normaliseCalendarUrl(input: string): { url: string } | { problem: string } {
  const text = input.trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return {
      problem:
        "That doesn't look like a link. Copy the whole address, starting with https or webcal.",
    };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return { problem: "Use your calendar's private https or webcal link." };
  if (!allowedHost(url))
    return {
      problem:
        "BookOn can read Google Calendar, iCloud and Outlook links. Write to us if you use another calendar.",
    };
  return { url: url.toString() };
}

/** Busy times from a calendar file, inside the window, as UTC instants. */
export function readBusyTimes(ics: string, window: { from: Date; to: Date }): BusyTime[] {
  if (!/BEGIN:VCALENDAR/i.test(ics)) throw new CalendarReadError("That link isn't a calendar.");
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(ics));
  } catch {
    throw new CalendarReadError("Your calendar couldn't be read. Check you copied the right link.");
  }
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      // A broken time zone definition: its times fall back to the zone name, or Perth.
    }
  }
  const events = root.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  const masters = new Map<string, ICAL.Event>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of events) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

  const busy: BusyTime[] = [];
  const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (!blocksTime(item)) return;
    const s = toUtc(start, zoneName(item, "dtstart"));
    const e = toUtc(end ?? start, zoneName(item, "dtend") ?? zoneName(item, "dtstart"));
    const finish = e > s ? e : new Date(s.getTime() + (start.isDate ? 86_400_000 : 0));
    if (finish > window.from && s < window.to && busy.length < MAX_BUSY)
      busy.push({ start: s, end: finish });
  };

  for (const event of masters.values()) {
    if (event.uid?.endsWith(BOOKON_UID_SUFFIX)) continue;
    if (!event.startDate) continue;
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate);
      continue;
    }
    const it = event.iterator();
    for (let n = 0, next = it.next(); next && n < 5000; n++, next = it.next()) {
      const details = event.getOccurrenceDetails(next);
      if (toUtc(details.startDate, zoneName(details.item, "dtstart")) >= window.to) break;
      add(details.item, details.startDate, details.endDate);
    }
  }
  return busy.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Free (transparent) and cancelled events don't stop bookings. */
function blocksTime(event: ICAL.Event): boolean {
  const transp = String(event.component.getFirstPropertyValue("transp") ?? "").toUpperCase();
  const status = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase();
  return transp !== "TRANSPARENT" && status !== "CANCELLED";
}

/** The TZID an event's time was written in, if any. */
function zoneName(event: ICAL.Event, property: "dtstart" | "dtend"): string | undefined {
  const tzid = event.component.getFirstProperty(property)?.getParameter("tzid");
  return typeof tzid === "string" ? tzid : undefined;
}

/**
 * Calendar times to UTC. Zones the calendar defines, and UTC, are converted
 * by ical.js; a zone it only names (like "Europe/London") by the system's
 * zone data; all-day and zone-less times are Perth.
 */
function toUtc(time: ICAL.Time, tzid: string | undefined): Date {
  const date = `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
  if (time.isDate) return perthToUtc(date, "00:00");
  const zone = time.zone?.tzid;
  if (zone === "UTC" || (zone && zone !== "floating" && ICAL.TimezoneService.has(zone)))
    return time.toJSDate();
  const named =
    tzid && !ICAL.TimezoneService.has(tzid)
      ? zonedToUtc(
          {
            year: time.year,
            month: time.month,
            day: time.day,
            hour: time.hour,
            minute: time.minute,
            second: time.second,
          },
          tzid,
        )
      : null;
  if (named) return named;
  const clock = `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
  return perthToUtc(date, clock);
}

/** Read the coach's calendar link and return its busy times in the window. */
export async function fetchBusyTimes(
  url: string,
  options: {
    userAgent: string;
    from: Date;
    to: Date;
    fetch?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<BusyTime[]> {
  const get = options.fetch ?? fetch;
  let current = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== "https:" || !allowedHost(current))
      throw new CalendarReadError("Your calendar link sent us somewhere we can't read.");
    let response: Response;
    try {
      response = await get(current, {
        headers: { "User-Agent": options.userAgent, Accept: "text/calendar, */*;q=0.5" },
        // Each redirect is checked against the calendar services before it's followed.
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      });
    } catch {
      throw new CalendarReadError("Your calendar didn't answer. We'll try again soon.");
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = new URL(response.headers.get("location")!, current);
      continue;
    }
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status === 410
    )
      throw new CalendarReadError(
        "Your calendar link doesn't work any more (it may have been reset). Paste the current one.",
      );
    if (!response.ok)
      throw new CalendarReadError("Your calendar didn't answer properly. We'll try again soon.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES)
      throw new CalendarReadError("Your calendar is too big for BookOn to read.");
    const text = await response.text();
    if (text.length > MAX_BYTES)
      throw new CalendarReadError("Your calendar is too big for BookOn to read.");
    return readBusyTimes(text, { from: options.from, to: options.to });
  }
  throw new CalendarReadError("Your calendar link redirects too many times.");
}
