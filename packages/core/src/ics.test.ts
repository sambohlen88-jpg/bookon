import { describe, expect, it } from "vitest";
import { calendarSubscribeLinks, googleCalendarEventLink, icsCalendar } from "./ics";
import { perthToUtc } from "./time";

const now = new Date("2026-10-19T04:00:00Z");
const event = {
  uid: "lesson-1@bookon",
  start: perthToUtc("2026-10-24", "09:00"),
  end: perthToUtc("2026-10-24", "10:00"),
  summary: "Golf lesson: Alex Golfer, Private lesson",
  description: "Mobile: 0491 570 110\nNote: slice, hooks; the lot",
  location: "Range, Como",
  status: "CONFIRMED" as const,
};

describe("icsCalendar", () => {
  it("writes events in UTC with text escaped and CRLF line ends", () => {
    const ics = icsCalendar({ name: "BookOn lessons", events: [event], now, refreshMinutes: 30 });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261024T010000Z\r\n");
    expect(ics).toContain("DTEND:20261024T020000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261019T040000Z\r\n");
    expect(ics).toContain("DESCRIPTION:Mobile: 0491 570 110\\nNote: slice\\, hooks\; the lot\r\n");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT30M\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("folds long lines at 75 bytes without splitting characters", () => {
    const long = { ...event, description: "Café ".repeat(40) };
    const ics = icsCalendar({ name: "x", events: [long], now });
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n"))
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`DESCRIPTION:${"Café ".repeat(40)}`);
  });
});

describe("calendar links", () => {
  it("open Google Calendar with the lesson filled in", () => {
    const url = new URL(googleCalendarEventLink(event));
    expect(url.searchParams.get("dates")).toBe("20261024T010000Z/20261024T020000Z");
    expect(url.searchParams.get("text")).toBe("Golf lesson: Alex Golfer, Private lesson");
    expect(url.searchParams.get("location")).toBe("Range, Como");
  });

  it("subscribe in Apple Calendar, Google Calendar and Outlook", () => {
    const links = calendarSubscribeLinks("https://bookon.au/calendar/abc.ics", "BookOn lessons");
    expect(links.apple).toBe("webcal://bookon.au/calendar/abc.ics");
    expect(links.google).toBe(
      "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fbookon.au%2Fcalendar%2Fabc.ics",
    );
    expect(links.outlook).toContain("url=https%3A%2F%2Fbookon.au%2Fcalendar%2Fabc.ics");
  });
});
