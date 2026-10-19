import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { CalendarReadError, fetchBusyTimes, normaliseCalendarUrl, readBusyTimes } from "./index";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/calendar/${name}`, import.meta.url), "utf8");
const window = { from: new Date("2026-10-19T00:00:00Z"), to: new Date("2026-11-23T00:00:00Z") };
const iso = (b: { start: Date; end: Date }) => `${b.start.toISOString()} ${b.end.toISOString()}`;

describe("readBusyTimes", () => {
  it("reads a Google calendar: zones, repeats, all-day, and skips free, cancelled and BookOn's own", () => {
    const busy = readBusyTimes(fixture("google-secret-address.ics"), window).map(iso);
    expect(busy).toEqual([
      // Dentist, Wed 21 Oct 10:00 to 11:30 Perth.
      "2026-10-21T02:00:00.000Z 2026-10-21T03:30:00.000Z",
      // Phone call, given in UTC.
      "2026-10-22T01:00:00.000Z 2026-10-22T02:00:00.000Z",
      // Call with the UK at 9 am London time (still on summer time).
      "2026-10-23T08:00:00.000Z 2026-10-23T09:00:00.000Z",
      // Saturday squad, moved to 8 to 10 that week.
      "2026-10-24T00:00:00.000Z 2026-10-24T02:00:00.000Z",
      // Pennant day, all day Wed 28 Oct in Perth.
      "2026-10-27T16:00:00.000Z 2026-10-28T16:00:00.000Z",
      // Squad skips 31 Oct, then back to 7 to 9 am.
      "2026-11-06T23:00:00.000Z 2026-11-07T01:00:00.000Z",
      "2026-11-13T23:00:00.000Z 2026-11-14T01:00:00.000Z",
      "2026-11-20T23:00:00.000Z 2026-11-21T01:00:00.000Z",
    ]);
  });

  it("reads Outlook's Windows time zone names from the calendar's own definitions", () => {
    const busy = readBusyTimes(fixture("outlook-published.ics"), window);
    expect(busy).toEqual([
      { start: perthToUtc("2026-10-26", "14:00"), end: perthToUtc("2026-10-26", "15:30") },
    ]);
  });

  it("treats times with no zone as Perth", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:floating",
      "DTSTART:20261029T090000",
      "DTEND:20261029T100000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(readBusyTimes(ics, window)).toEqual([
      { start: perthToUtc("2026-10-29", "09:00"), end: perthToUtc("2026-10-29", "10:00") },
    ]);
  });

  it("says when a link isn't a calendar", () => {
    expect(() => readBusyTimes("<html>Sign in</html>", window)).toThrow(CalendarReadError);
  });
});

describe("normaliseCalendarUrl", () => {
  it("accepts Google, iCloud and Outlook links, turning webcal into https", () => {
    expect(
      normaliseCalendarUrl(
        " https://calendar.google.com/calendar/ical/mia%40gmail.com/private-abc123/basic.ics ",
      ),
    ).toEqual({
      url: "https://calendar.google.com/calendar/ical/mia%40gmail.com/private-abc123/basic.ics",
    });
    expect(normaliseCalendarUrl("webcal://p52-caldav.icloud.com/published/2/abc")).toEqual({
      url: "https://p52-caldav.icloud.com/published/2/abc",
    });
    expect(
      "url" in
        normaliseCalendarUrl("https://outlook.office365.com/owa/calendar/abc/reachcalendar.ics"),
    ).toBe(true);
  });

  it("refuses anything else, so the worker can't be pointed at another server", () => {
    for (const bad of [
      "https://example.com/cal.ics",
      "http://calendar.google.com/x.ics",
      "https://calendar.google.com.evil.example/x.ics",
      "https://user:pass@calendar.google.com/x.ics",
      "https://169.254.169.254/latest",
      "not a link",
    ]) {
      expect("problem" in normaliseCalendarUrl(bad), bad).toBe(true);
    }
  });
});

describe("fetchBusyTimes", () => {
  const userAgent = "BookOnBot/0.1 (test)";
  function serve(routes: Record<string, Response | (() => Response)>) {
    const asked: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      asked.push(url);
      const answer = routes[url];
      if (!answer) return new Response("not found", { status: 404 });
      return typeof answer === "function" ? answer() : answer;
    }) as typeof fetch;
    return { asked, fetchImpl };
  }

  it("follows redirects between calendar servers", async () => {
    const { asked, fetchImpl } = serve({
      "https://p52-caldav.icloud.com/published/2/abc": new Response(null, {
        status: 301,
        headers: { location: "https://p71-caldav.icloud.com/published/2/abc" },
      }),
      "https://p71-caldav.icloud.com/published/2/abc": new Response(
        fixture("outlook-published.ics"),
      ),
    });
    const busy = await fetchBusyTimes("https://p52-caldav.icloud.com/published/2/abc", {
      userAgent,
      ...window,
      fetch: fetchImpl,
    });
    expect(busy).toHaveLength(1);
    expect(asked).toHaveLength(2);
  });

  it("won't follow a redirect anywhere else", async () => {
    const { fetchImpl } = serve({
      "https://calendar.google.com/x.ics": new Response(null, {
        status: 302,
        headers: { location: "http://10.0.0.1/admin" },
      }),
    });
    await expect(
      fetchBusyTimes("https://calendar.google.com/x.ics", {
        userAgent,
        ...window,
        fetch: fetchImpl,
      }),
    ).rejects.toThrow("sent us somewhere we can't read");
  });

  it("explains a link that stopped working", async () => {
    const { fetchImpl } = serve({});
    await expect(
      fetchBusyTimes("https://calendar.google.com/x.ics", {
        userAgent,
        ...window,
        fetch: fetchImpl,
      }),
    ).rejects.toThrow("doesn't work any more");
  });
});
