/**
 * Calendar files (iCalendar, RFC 5545) for coaches' calendar apps and
 * golfers' "Add to calendar" (Milestone 16). Apple Calendar, Google Calendar
 * and Outlook all read these.
 */

export interface CalendarEvent {
  /** Stable across updates, so calendar apps change the event rather than add another. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
}

/** Every BookOn event's UID ends with this, so reading a coach's calendar can skip BookOn's own lessons. */
export const BOOKON_UID_SUFFIX = "@bookon";

/** "20261024T010000Z" */
export function icsTime(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 bytes are folded onto continuation lines starting with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line holds 75 bytes; continuation lines lose one to the leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsCalendar(input: {
  name: string;
  events: CalendarEvent[];
  now: Date;
  /** How often subscribed calendar apps should check again. */
  refreshMinutes?: number;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookOn//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.name)}`,
    "X-WR-TIMEZONE:Australia/Perth",
  ];
  if (input.refreshMinutes) {
    lines.push(
      `REFRESH-INTERVAL;VALUE=DURATION:PT${input.refreshMinutes}M`,
      `X-PUBLISHED-TTL:PT${input.refreshMinutes}M`,
    );
  }
  for (const e of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsTime(input.now)}`,
      `DTSTART:${icsTime(e.start)}`,
      `DTEND:${icsTime(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.status) lines.push(`STATUS:${e.status}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Opens Google Calendar with the event filled in, ready to save. */
export function googleCalendarEventLink(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.summary,
    dates: `${icsTime(e.start)}/${icsTime(e.end)}`,
  });
  if (e.description) p.set("details", e.description);
  if (e.location) p.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Links that add a calendar subscription to each app, from its https address. */
export function calendarSubscribeLinks(httpsUrl: string, name: string) {
  const webcal = httpsUrl.replace(/^https?:\/\//, "webcal://");
  return {
    /** Apple Calendar (iPhone, iPad and Mac), and most other calendar apps. */
    apple: webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(name)}`,
  };
}
