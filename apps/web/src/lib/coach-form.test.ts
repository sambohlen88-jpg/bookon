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
  rate0Kind: "private",
  rate1Name: "Clinic",
  rate1Minutes: "60",
  rate1Price: "40.50",
  rate1People: "group",
  rate1Kind: "group-clinic",
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
        { name: "Private lesson", kind: "private", minutes: 60, priceCents: 11000, people: "1" },
        { name: "Clinic", kind: "group-clinic", minutes: 60, priceCents: 4050, people: "group" },
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

  it("reads travel and where each lesson is taught (Milestone 26)", () => {
    const { profile, problems } = parseCoachForm(
      form({
        ...complete,
        travel: "on",
        travelArea: ["south", "east", "nowhere"],
        travelNote: "Within 20 km of Como",
        rate0Where: "some",
        rate0At: ["1", "player"],
        rate1Where: "all",
        rate1At: ["0"],
      }),
      courses,
    );
    expect(problems).toEqual([]);
    expect(profile.travel).toEqual({ areas: ["south", "east"], note: "Within 20 km of Como" });
    expect(profile.rates[0]!.at).toEqual(["home studio|kensington", "player"]);
    expect(profile.rates[1]!.at).toBeUndefined();
  });

  it("lets a travelling coach skip places, and checks the new choices", () => {
    const { profile, problems } = parseCoachForm(
      form({
        ...complete,
        place0Course: "",
        place1Name: "",
        place1Suburb: "",
        travel: "on",
        rate0Kind: "",
        rate1Where: "some",
      }),
      courses,
    );
    expect(profile.places).toEqual([]);
    expect(problems).toEqual([
      "Pick the areas you'll travel to.",
      "Lesson 1: pick the type of lesson.",
      "Lesson 2: pick where it's taught.",
    ]);
    const noPlaces = parseCoachForm(
      form({ ...complete, place0Course: "", place1Name: "", place1Suburb: "" }),
      courses,
    );
    expect(noPlaces.problems).toContain(
      "Add at least one place you teach, or say you're happy to travel.",
    );
  });

  it("takes up to 10 places and 12 lessons, wherever they are on the form", () => {
    const values: Record<string, string | string[]> = {
      ...complete,
      place0Course: "",
      place1Name: "",
      place1Suburb: "",
    };
    for (let i = 0; i < 11; i++)
      Object.assign(values, { [`place${i}Name`]: `Park ${i}`, [`place${i}Suburb`]: "Como" });
    for (let i = 0; i < 13; i++)
      Object.assign(values, {
        [`rate${i}Name`]: `Lesson ${i}`,
        [`rate${i}Minutes`]: "30",
        [`rate${i}Price`]: "50",
        [`rate${i}Kind`]: "private",
      });
    const { profile } = parseCoachForm(form(values), courses);
    expect(profile.places).toHaveLength(10);
    expect(profile.rates).toHaveLength(12);
  });
});
