import { describe, expect, it } from "vitest";
import { activityCsv, reportRange } from "./report";

const now = new Date("2026-10-18T02:00:00Z");

describe("reportRange", () => {
  it("defaults to the last 30 Perth days, and ignores nonsense", () => {
    expect(reportRange({}, now)).toEqual({ from: "2026-09-19", to: "2026-10-18" });
    expect(reportRange({ from: "2026-10-01", to: "2026-10-10" }, now)).toEqual({
      from: "2026-10-01",
      to: "2026-10-10",
    });
    expect(reportRange({ from: "2026-10-11", to: "2026-10-10" }, now).from).toBe("2026-09-11");
    expect(reportRange({ from: "'; drop", to: "x" }, now)).toEqual({
      from: "2026-09-19",
      to: "2026-10-18",
    });
  });
});

describe("activityCsv", () => {
  it("makes a spreadsheet-safe CSV", () => {
    const csv = activityCsv(
      [
        {
          courseId: "1",
          slug: "a",
          name: "Lake, Pines",
          searches: 3,
          impressions: 2,
          clicks: 1,
          golfers: 1,
          alertClicks: 0,
          shareClicks: 0,
        },
        {
          courseId: "2",
          slug: "b",
          name: '=HYPERLINK("x")',
          searches: 0,
          impressions: 0,
          clicks: 0,
          golfers: 0,
          alertClicks: 0,
          shareClicks: 0,
        },
      ],
      "2026-10-01",
      "2026-10-31",
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(
      "Course,From,To,Searches,Times shown,Clicks,Golfers,From alerts,From shares",
    );
    expect(lines[1]).toBe('"Lake, Pines",2026-10-01,2026-10-31,3,2,1,1,0,0');
    // A name that looks like a formula is never run by Excel.
    expect(lines[2]!.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
