import { describe, expect, it } from "vitest";
import { parseCoachForm } from "./coach-form";

const courses = [{ slug: "collier-park", name: "Collier Park Golf Course", suburb: "Como" }];

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  return data;
}

const complete = {
  name: "Sam Coach",
  headline: "Short game",
  bio: "Lessons for everyone.",
  pgaNumber: "12345",
  speciality: ["short-game", "putting", "made-up"],
  suburb: "Como",
  area: "south",
  place0Course: "collier-park",
  place1Name: "Home studio",
  place1Suburb: "Kensington",
  rate0Name: "Private lesson",
  rate0Minutes: "60",
  rate0Price: "$110",
  rate0People: "1",
  rate1Name: "Clinic",
  rate1Minutes: "60",
  rate1Price: "40.50",
  rate1People: "group",
  hours2From: "15:00",
  hours2To: "19:00",
  hours6From: "07:00",
  hours6To: "12:00",
  away0From: "2026-12-24",
  away0To: "2027-01-02",
  whatsapp: "0491 570 156",
  email: "Sam@Coach.test",
  website: "samcoach.example",
};

describe("parseCoachForm", () => {
  it("reads a complete listing", () => {
    const { profile, problems } = parseCoachForm(form(complete), courses);
    expect(problems).toEqual([]);
    expect(profile).toMatchObject({
      name: "Sam Coach",
      pgaNumber: "12345",
      specialities: ["short-game", "putting"],
      area: "south",
      places: [
        { courseSlug: "collier-park", name: "Collier Park Golf Course", suburb: "Como" },
        { name: "Home studio", suburb: "Kensington" },
      ],
      rates: [
        { name: "Private lesson", minutes: 60, priceCents: 11000, people: "1" },
        { name: "Clinic", minutes: 60, priceCents: 4050, people: "group" },
      ],
      hours: [
        { day: 2, from: "15:00", to: "19:00" },
        { day: 6, from: "07:00", to: "12:00" },
      ],
      away: [{ from: "2026-12-24", to: "2027-01-02" }],
      contact: {
        whatsapp: "+61491570156",
        email: "sam@coach.test",
        website: "https://samcoach.example/",
      },
    });
  });

  it("says what's missing or wrong", () => {
    const { problems } = parseCoachForm(
      form({
        ...complete,
        speciality: [],
        hours2From: "19:00",
        rate0Price: "",
        rate1Name: "",
        rate1Price: "",
        whatsapp: "12",
        email: "",
      }),
      courses,
    );
    expect(problems).toEqual([
      "Pick at least one speciality.",
      "Lesson 1 needs a name, a length in minutes and a price.",
      "Add at least one lesson and its price.",
      "Each teaching day needs a start time before its finish time.",
      "Check your WhatsApp number (an Australian mobile).",
      "Add at least one way to reach you: WhatsApp, phone or email.",
    ]);
  });
});
