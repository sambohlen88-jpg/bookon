import { describe, expect, it } from "vitest";
import type { LiveCoach } from "@bookon/db";
import { directoryCoach } from "./coaches";

const coach: LiveCoach = {
  id: "c1",
  slug: "sam-coach",
  profile: {
    name: "Sam Coach",
    headline: "Short game",
    bio: "Lessons for everyone.",
    specialities: ["short-game"],
    rates: [
      { name: "Private lesson", kind: "private", minutes: 60, priceCents: 9000, people: "1" },
      { name: "9 hole playing lesson", minutes: 120, priceCents: 20000, people: "1" },
    ],
    hours: [],
    away: [],
    places: [
      { courseSlug: "wembley", name: "Wembley Golf Course", suburb: "Wembley Downs" },
      { name: "Home studio", suburb: "Joondalup" },
    ],
    travel: { areas: ["north", "east"] },
    suburb: "Joondalup",
    area: "north",
    contact: {},
  },
  pgaVerified: true,
  sample: false,
  latitude: null,
  longitude: null,
  photoId: null,
  takesBookings: false,
};

describe("directoryCoach (Milestone 26)", () => {
  it("lists every area a coach teaches in, travel and lesson types", () => {
    const c = directoryCoach(
      coach,
      new Date("2026-10-26T00:00:00Z"),
      new Map([["wembley", "west"]]),
    );
    expect(c.areas).toEqual(["north", "east", "west"]);
    expect(c.travels).toBe(true);
    expect(c.kinds).toEqual(["private", "playing"]);
  });
  it("keeps to the base area for a coach who doesn't travel", () => {
    const c = directoryCoach(
      { ...coach, profile: { ...coach.profile, travel: undefined, places: [] } },
      new Date("2026-10-26T00:00:00Z"),
    );
    expect(c.areas).toEqual(["north"]);
    expect(c.travels).toBe(false);
  });
});
