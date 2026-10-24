import { describe, expect, it } from "vitest";
import {
  analyticsExcluded,
  analyticsRange,
  isBot,
  pageName,
  parseUserAgent,
  percentChange,
  trafficSource,
  vitalRating,
} from "./analytics";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const FACEBOOK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]";

describe("page names", () => {
  it("groups public pages and drops query strings", () => {
    expect(pageName("/")).toEqual({ path: "/", section: "Home" });
    expect(pageName("/search?date=2026-11-01&players=2")).toEqual({
      path: "/search",
      section: "Search results",
    });
    expect(pageName("/courses/point-walter/")).toEqual({
      path: "/courses/point-walter",
      section: "Course page",
    });
    expect(pageName("/coaches/sam-pro/book")?.section).toBe("Lesson booking");
    expect(pageName("/something-new")?.section).toBe("Other");
    expect(pageName("/news/summer-golf")?.section).toBe("News article");
  });

  it("never stores the token in a private link", () => {
    expect(pageName("/lessons/abcDEF123secret")).toEqual({
      path: "/lessons/:link",
      section: "Lesson booking (golfer's page)",
    });
    expect(pageName("/matchplay/entry/tok_123456789")?.path).toBe("/matchplay/entry/:link");
    expect(pageName("/clubs/join/tok/details")?.path).toBe("/clubs/join/:link");
    expect(pageName("/matchplay/0b4c2f9e-0000-4000-8000-000000000000")?.section).toBe("Match play");
  });

  it("leaves out the portals", () => {
    for (const p of [
      "/admin",
      "/admin/reports",
      "/club/x/events",
      "/coach",
      "/coach/calendar",
      "/write/new",
    ])
      expect(analyticsExcluded(p)).toBe(true);
    for (const p of ["/clubs", "/coaches", "/coaching", "/courses"])
      expect(analyticsExcluded(p)).toBe(false);
    expect(pageName("/admin/analytics")).toBeNull();
  });
});

describe("devices", () => {
  it("reads phones, tablets and desktops", () => {
    expect(parseUserAgent(IPHONE)).toEqual({ device: "Phone", browser: "Safari", os: "iOS" });
    expect(parseUserAgent(ANDROID)).toEqual({ device: "Phone", browser: "Chrome", os: "Android" });
    expect(parseUserAgent(IPAD).device).toBe("Tablet");
    expect(parseUserAgent(WINDOWS_EDGE)).toEqual({
      device: "Desktop",
      browser: "Edge",
      os: "Windows",
    });
    expect(parseUserAgent(FACEBOOK).browser).toBe("Facebook app");
  });

  it("spots bots and scripts", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/129.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(IPHONE)).toBe(false);
  });
});

describe("where visitors come from", () => {
  const own = "bookon.com.au";
  it("sorts referrers into channels", () => {
    expect(trafficSource({ referrer: "https://www.google.com.au/", ownHost: own })).toEqual({
      channel: "Search",
      source: "Google",
      referrerHost: "google.com.au",
    });
    expect(trafficSource({ referrer: "https://l.facebook.com/l.php", ownHost: own })?.source).toBe(
      "Facebook",
    );
    expect(trafficSource({ referrer: "https://golfwa.com.au/news", ownHost: own })).toEqual({
      channel: "Other sites",
      source: "golfwa.com.au",
      referrerHost: "golfwa.com.au",
    });
    expect(trafficSource({ referrer: null, ownHost: own })?.channel).toBe("Direct");
  });

  it("counts BookOn's own emails and campaigns", () => {
    expect(
      trafficSource({
        referrer: null,
        ownHost: own,
        utm: { source: "bookon", medium: "email", campaign: "alert" },
      }),
    ).toEqual({ channel: "Email", source: "BookOn emails", referrerHost: null });
    expect(trafficSource({ referrer: null, ownHost: own, utm: { source: "flyer" } })?.channel).toBe(
      "Campaign",
    );
  });

  it("ignores moving between BookOn's own pages", () => {
    expect(trafficSource({ referrer: "https://www.bookon.com.au/courses", ownHost: own })).toBe(
      null,
    );
  });
});

describe("ranges", () => {
  it("reads presets with the period before", () => {
    expect(analyticsRange({ range: "7d" }, "2026-10-24")).toMatchObject({
      from: "2026-10-18",
      to: "2026-10-24",
      days: 7,
      previous: { from: "2026-10-11", to: "2026-10-17" },
      bucket: "day",
    });
    expect(analyticsRange({ range: "today" }, "2026-10-24").bucket).toBe("hour");
    expect(analyticsRange({ range: "12m" }, "2026-10-24").bucket).toBe("week");
    expect(analyticsRange({ range: "nonsense" }, "2026-10-24").days).toBe(30);
  });

  it("reads your own dates, in either order, not past today", () => {
    expect(
      analyticsRange({ range: "custom", from: "2026-10-30", to: "2026-10-01" }, "2026-10-24"),
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-24", days: 24 });
  });

  it("works out changes and speed ratings", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
    expect(vitalRating("LCP", 2000)).toBe("good");
    expect(vitalRating("CLS", 0.3)).toBe("poor");
  });
});
