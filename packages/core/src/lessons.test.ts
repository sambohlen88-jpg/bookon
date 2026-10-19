import { describe, expect, it } from "vitest";
import type { CoachProfile } from "./coaching";
import { bookableRates, bookingDates, freeToCancel, lessonSlots, respondBy } from "./lessons";
import { formatPerthTime, perthToUtc } from "./time";

const profile: Pick<CoachProfile, "hours" | "away" | "rates"> = {
  // Wednesday 9:15 to 12:00 and 3 to 5 pm; Saturday 7 to 11 am.
  hours: [
    { day: 3, from: "09:15", to: "12:00" },
    { day: 3, from: "15:00", to: "17:00" },
    { day: 6, from: "07:00", to: "11:00" },
  ],
  away: [{ from: "2026-10-31", to: "2026-10-31" }],
  rates: [
    { name: "Private lesson", minutes: 60, priceCents: 9000, people: "1" },
    { name: "Clinic", minutes: 90, priceCents: 4000, people: "group" },
    { name: "Two of you", minutes: 60, priceCents: 12000, people: "2" },
  ],
};

// Sunday 18 October 2026, 8 am Perth.
const now = perthToUtc("2026-10-18", "08:00");
const times = (slots: Date[]) => slots.map(formatPerthTime);

describe("lessonSlots", () => {
  it("starts on the half hour inside each block, leaving room for the whole lesson", () => {
    expect(times(lessonSlots(profile, 60, "2026-10-21", now, []))).toEqual([
      "9:30 am",
      "10:00 am",
      "10:30 am",
      "11:00 am",
      "3:00 pm",
      "3:30 pm",
      "4:00 pm",
    ]);
  });

  it("leaves out times that overlap a lesson already held or booked", () => {
    const taken = [
      {
        start: perthToUtc("2026-10-21", "10:00"),
        end: perthToUtc("2026-10-21", "11:00"),
      },
    ];
    expect(times(lessonSlots(profile, 60, "2026-10-21", now, taken))).toEqual([
      "11:00 am",
      "3:00 pm",
      "3:30 pm",
      "4:00 pm",
    ]);
  });

  it("needs 12 hours' notice", () => {
    const tuesdayNight = perthToUtc("2026-10-20", "22:00");
    expect(times(lessonSlots(profile, 60, "2026-10-21", tuesdayNight, []))).toEqual([
      "10:00 am",
      "10:30 am",
      "11:00 am",
      "3:00 pm",
      "3:30 pm",
      "4:00 pm",
    ]);
  });

  it("has nothing on days away, days without hours, past days or beyond four weeks", () => {
    expect(lessonSlots(profile, 60, "2026-10-31", now, [])).toEqual([]);
    expect(lessonSlots(profile, 60, "2026-10-22", now, [])).toEqual([]);
    expect(lessonSlots(profile, 60, "2026-10-14", now, [])).toEqual([]);
    expect(lessonSlots(profile, 60, "2026-11-18", now, [])).toEqual([]);
    // Saturday 14 November, four weeks out: 7 am to 10 am.
    expect(lessonSlots(profile, 60, "2026-11-14", now, [])).toHaveLength(7);
  });
});

describe("bookableRates", () => {
  it("leaves out group clinics", () => {
    expect(bookableRates(profile).map((r) => r.name)).toEqual(["Private lesson", "Two of you"]);
  });
});

describe("bookingDates", () => {
  it("runs from today for four weeks", () => {
    const dates = bookingDates(now);
    expect(dates[0]).toBe("2026-10-18");
    expect(dates.at(-1)).toBe("2026-11-15");
  });
});

describe("respondBy", () => {
  it("gives the coach 48 hours, but closes 2 hours before the lesson", () => {
    const lesson = perthToUtc("2026-10-28", "09:00");
    expect(respondBy(now, lesson)).toEqual(perthToUtc("2026-10-20", "08:00"));
    const soon = perthToUtc("2026-10-19", "09:00");
    expect(respondBy(now, soon)).toEqual(perthToUtc("2026-10-19", "07:00"));
  });
});

describe("freeToCancel", () => {
  it("refunds up to 24 hours before", () => {
    const lesson = perthToUtc("2026-10-19", "08:00");
    expect(freeToCancel(lesson, now)).toBe(true);
    expect(freeToCancel(lesson, new Date(now.getTime() + 1000))).toBe(false);
  });
});
