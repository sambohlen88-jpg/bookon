import { describe, expect, it } from "vitest";
import { activityCsv, reportRange, unbookedCsv } from "./report";

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

describe("unbookedCsv", () => {
  it("lists each course's unbooked tee times, green fees in dollars and the breakdowns", () => {
    const csv = unbookedCsv(
      [
        {
          courseId: "1",
          slug: "collier-park",
          name: "Collier Park Golf Course",
          unbooked: 2,
          spots: 6,
          valueCents: 16050,
          priced: 1,
          coverage: 0.615,
          byWeekday: [2, 0, 0, 0, 0, 0, 0],
          byPart: { early: 1, morning: 0, midday: 0, afternoon: 0, twilight: 1 },
        },
      ],
      "2026-10-19",
      "2026-10-19",
    );
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe(
      "Course,From,To,Unbooked tee times,Empty player spots,Green fees not earned ($),Tee times with a price,Checked (%),Mon,Tue,Wed,Thu,Fri,Sat,Sun,Before 7 am,7 to 10 am,10 am to 1 pm,1 to 4 pm,4 pm on",
    );
    expect(row).toBe(
      "Collier Park Golf Course,2026-10-19,2026-10-19,2,6,161,1,62,2,0,0,0,0,0,0,1,0,0,0,1",
    );
  });
});
