import { describe, expect, it } from "vitest";
import { cheapestCents, sortCourses, type SortFacts } from "./sorting";

const course = (name: string, f: Partial<SortFacts>): SortFacts => ({
  name,
  firstStart: null,
  cheapestCents: null,
  freeTimes: 0,
  rating: null,
  km: null,
  ...f,
});

const collier = course("Collier Park", {
  firstStart: 3,
  cheapestCents: 3300,
  freeTimes: 40,
  rating: { average: 4.2, count: 12 },
  km: 9,
});
const whaleback = course("Whaleback", {
  firstStart: 1,
  cheapestCents: 2900,
  freeTimes: 6,
  rating: { average: 4.6, count: 2 },
  km: 15,
});
const hamersley = course("Hamersley", {
  firstStart: 2,
  cheapestCents: null,
  freeTimes: 18,
  rating: { average: 3.9, count: 30 },
  km: 3,
});
const full = course("Araluen", { rating: { average: 5, count: 50 }, km: 1 });
const all = [full, collier, whaleback, hamersley];
const names = (list: SortFacts[]) => list.map((c) => c.name);
const sort = (choice: Parameters<typeof sortCourses>[1], freeFirst = true) =>
  names(sortCourses(all, choice, (c) => c, { freeFirst }));

describe("sortCourses", () => {
  it("soonest first, with fully booked courses last", () => {
    expect(sort("soonest")).toEqual(["Whaleback", "Hamersley", "Collier Park", "Araluen"]);
  });

  it("cheapest first; clubs with no prices after those with", () => {
    expect(sort("price")).toEqual(["Whaleback", "Collier Park", "Hamersley", "Araluen"]);
  });

  it("most free times first", () => {
    expect(sort("available")).toEqual(["Collier Park", "Hamersley", "Whaleback", "Araluen"]);
  });

  it("top rated, counting only courses with enough ratings", () => {
    // Whaleback's 4.6 is from 2 ratings, so it goes after the rated courses.
    expect(sort("rating")).toEqual(["Collier Park", "Hamersley", "Whaleback", "Araluen"]);
  });

  it("nearest first", () => {
    expect(sort("near")).toEqual(["Hamersley", "Collier Park", "Whaleback", "Araluen"]);
  });

  it("can leave fully booked courses where they fall (the Courses page)", () => {
    expect(sort("rating", false)).toEqual(["Araluen", "Collier Park", "Hamersley", "Whaleback"]);
    expect(sort("name", false)).toEqual(["Araluen", "Collier Park", "Hamersley", "Whaleback"]);
  });
});

describe("cheapestCents", () => {
  it("ignores times with no price", () => {
    expect(cheapestCents([{ priceCents: null }, { priceCents: 4500 }, { priceCents: 3900 }])).toBe(
      3900,
    );
    expect(cheapestCents([{ priceCents: null }])).toBeNull();
  });
});
