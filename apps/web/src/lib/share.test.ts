import { describe, expect, it } from "vitest";
import type { ShareContent, SharedCourse, SharedTeeTime } from "@bookon/db";
import { distinctTimes, priceSummary, shareDetails, shareText, shareTitle } from "./share";

function time(perth: string, priceCents: number | null = 3200): SharedTeeTime {
  return {
    startTime: new Date(`${perth}+08:00`).toISOString(),
    playDate: perth.slice(0, 10),
    holes: 18,
    spotsAvailable: 4,
    priceCents,
    bookingUrl: "https://example.com/book",
  };
}

function course(name: string, teeTimes: SharedTeeTime[], total = teeTimes.length): SharedCourse {
  return {
    id: name,
    slug: name.toLowerCase(),
    name,
    suburb: "Como",
    bookingUrl: "https://example.com",
    total,
    teeTimes,
  };
}

const oneDay: ShareContent["params"] = {
  dateFrom: "2026-10-24",
  dateTo: "2026-10-24",
  timeFrom: "05:00",
  timeTo: "20:00",
  players: 4,
  holes: null,
  courseSlugs: null,
};

describe("share wording", () => {
  it("titles one day or a range, with the search details", () => {
    expect(shareTitle(oneDay)).toBe("Tee times for Sat 24 Oct");
    expect(shareTitle({ ...oneDay, dateTo: "2026-10-26" })).toBe(
      "Tee times, Sat 24 Oct to Mon 26 Oct",
    );
    expect(shareDetails(oneDay)).toBe("4 players · any time · 9 or 18 holes");
    expect(
      shareDetails({ ...oneDay, players: 1, timeFrom: "06:00", timeTo: "09:30", holes: 9 }),
    ).toBe("1 player · 6:00 am to 9:30 am · 9 holes");
  });

  it("sums up prices", () => {
    expect(priceSummary([time("2026-10-24T07:00"), time("2026-10-24T07:10")])).toBe("$32");
    expect(priceSummary([time("2026-10-24T07:00", 2850), time("2026-10-24T07:10")])).toBe(
      "from $28.50",
    );
    expect(priceSummary([time("2026-10-24T07:00", null)])).toBeNull();
  });

  it("shows a time once when a club starts groups off two tees", () => {
    const times = [time("2026-10-24T08:00"), time("2026-10-24T08:00"), time("2026-10-24T08:10")];
    expect(distinctTimes(times)).toHaveLength(2);
  });
});

describe("shareText", () => {
  it("lists each course's times for a group chat, with the link", () => {
    const text = shareText(
      {
        params: oneDay,
        query: "",
        totalTeeTimes: 13,
        courses: [
          course("Collier Park", [
            time("2026-10-24T07:10"),
            time("2026-10-24T07:20"),
            time("2026-10-24T07:20"), // second tee
            time("2026-10-24T08:40"),
          ]),
          course(
            "Whaleback",
            Array.from({ length: 9 }, (_, i) => time(`2026-10-24T09:0${i}`, null)),
          ),
        ],
      },
      "https://bookon.com.au/s/abc",
    );
    expect(text).toBe(
      [
        "Tee times for Sat 24 Oct",
        "4 players · any time · 9 or 18 holes",
        "",
        "Collier Park: 7:10 am, 7:20 am, 8:40 am ($32)",
        "Whaleback: 9:00 am, 9:01 am, 9:02 am, 9:03 am, 9:04 am, 9:05 am, 9:06 am, 9:07 am +1 more",
        "",
        "https://bookon.com.au/s/abc",
      ].join("\n"),
    );
  });

  it("groups longer searches by day and counts what's left", () => {
    const text = shareText(
      {
        params: { ...oneDay, dateTo: "2026-10-25" },
        query: "",
        totalTeeTimes: 30,
        courses: [
          course(
            "Collier Park",
            [
              ...["06", "07", "08", "09", "10"].map((h) => time(`2026-10-24T${h}:00`)),
              time("2026-10-25T07:00"),
            ],
            30,
          ),
        ],
      },
      "https://bookon.com.au/s/abc",
    );
    expect(text.split("\n")[3]).toBe(
      "Collier Park: Sat 24 Oct 6:00 am, 7:00 am, 8:00 am, 9:00 am; Sun 25 Oct 7:00 am +25 more ($32)",
    );
  });
});
