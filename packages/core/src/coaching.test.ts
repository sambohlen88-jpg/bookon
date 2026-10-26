import { describe, expect, it } from "vitest";
import {
  formatAuPhone,
  fromPriceCents,
  guessLessonKind,
  isLessonKind,
  lessonKindName,
  lessonPlaces,
  normaliseAuPhone,
  PLAYER_CHOICE,
  placeKey,
  teachingDates,
  weekDates,
  whatsappLink,
} from "./coaching";

// Sunday 18 October 2026.
const sunday = "2026-10-18";
// Wednesday 21 October 2026.
const wednesday = "2026-10-21";

describe("weekDates", () => {
  it("runs this week from today to Sunday, and next week Monday to Sunday", () => {
    expect(weekDates(wednesday, "this")).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(weekDates(wednesday, "next")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    // On a Sunday, this week is just today.
    expect(weekDates(sunday, "this")).toEqual([sunday]);
    expect(weekDates(sunday, "next")[0]).toBe("2026-10-19");
  });
});

describe("teachingDates", () => {
  const coach = {
    hours: [
      { day: 2, from: "15:00", to: "19:00" },
      { day: 6, from: "07:00", to: "12:00" },
    ],
    away: [{ from: "2026-10-27", to: "2026-10-29" }],
  };

  it("lists the days with usual hours, leaving out days away", () => {
    expect(teachingDates(coach, weekDates(wednesday, "this"))).toEqual(["2026-10-24"]);
    // Tuesday the 27th is a day away, so only Saturday.
    expect(teachingDates(coach, weekDates(wednesday, "next"))).toEqual(["2026-10-31"]);
  });

  it("only counts today while hours are still to come", () => {
    const saturday = "2026-10-24";
    expect(teachingDates(coach, [saturday], saturday, "11:00")).toEqual([saturday]);
    expect(teachingDates(coach, [saturday], saturday, "12:00")).toEqual([]);
  });
});

describe("contact", () => {
  it("reads Australian phone numbers", () => {
    expect(normaliseAuPhone("0491 570 156")).toBe("+61491570156");
    expect(normaliseAuPhone("+61 491 570 156")).toBe("+61491570156");
    expect(normaliseAuPhone("(08) 9123 4567")).toBe("+61891234567");
    expect(normaliseAuPhone("12345")).toBeNull();
    expect(formatAuPhone("+61491570156")).toBe("0491 570 156");
    expect(formatAuPhone("+61891234567")).toBe("(08) 9123 4567");
  });

  it("opens WhatsApp with a message ready", () => {
    expect(whatsappLink("+61491570156", "Hi Mia, I found you on BookOn")).toBe(
      "https://wa.me/61491570156?text=Hi%20Mia%2C%20I%20found%20you%20on%20BookOn",
    );
  });

  it("finds the cheapest lesson", () => {
    expect(
      fromPriceCents({
        rates: [
          { name: "60 min", minutes: 60, priceCents: 11000, people: "1" },
          { name: "Clinic", minutes: 60, priceCents: 4000, people: "group" },
        ],
      }),
    ).toBe(4000);
    expect(fromPriceCents({ rates: [] })).toBeNull();
  });
});

describe("places and lessons (Milestone 26)", () => {
  const places = [
    { courseSlug: "wembley", name: "Wembley Golf Course", suburb: "Wembley Downs" },
    { name: "Home studio", suburb: "Joondalup" },
  ];
  it("keys places so lessons keep pointing at them", () => {
    expect(placeKey(places[0]!)).toBe("course:wembley");
    expect(placeKey(places[1]!)).toBe("home studio|joondalup");
  });
  it("works out where a lesson can be", () => {
    const travel = { areas: ["north"] };
    expect(lessonPlaces({ places, travel }, {})).toEqual({ places, playerChoice: true });
    expect(lessonPlaces({ places }, { at: ["course:wembley"] })).toEqual({
      places: [places[0]],
      playerChoice: false,
    });
    expect(lessonPlaces({ places, travel }, { at: [PLAYER_CHOICE] })).toEqual({
      places: [],
      playerChoice: true,
    });
    // Its only place was removed: everywhere again.
    expect(lessonPlaces({ places }, { at: ["course:gone"] })).toEqual({
      places,
      playerChoice: false,
    });
  });
  it("names lesson kinds", () => {
    expect(lessonKindName("playing")).toBe("Playing lesson");
    expect(isLessonKind("nope")).toBe(false);
    expect(guessLessonKind({ name: "9 hole playing lesson", people: "1" })).toBe("playing");
    expect(guessLessonKind({ name: "Junior clinic", people: "group" })).toBe("junior");
    expect(guessLessonKind({ name: "Saturday session", people: "group" })).toBe("group-clinic");
    expect(guessLessonKind({ name: "Private lesson", people: "1" })).toBe("private");
    expect(guessLessonKind({ name: "Clinic", people: "1", kind: "video" })).toBe("video");
  });
});
