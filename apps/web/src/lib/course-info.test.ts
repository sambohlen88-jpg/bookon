import { describe, expect, it } from "vitest";
import { listCourseDetails } from "@bookon/db";
import { AREAS, courseArea, courseScenery, shortCourseName } from "./course-info";

describe("course info", () => {
  it("places courses in their part of WA", () => {
    expect(courseArea("collier-park")).toBe("Perth");
    expect(courseArea("the-cut")).toBe("Peel");
    expect(courseArea("broome")).toBe("Pilbara and Kimberley");
    // A course added later still shows, under Perth, until it's given an area.
    expect(courseArea("new-course")).toBe("Perth");
    expect(AREAS).toContain(courseArea("albany"));
  });

  it("picks scenery for the illustrations", () => {
    expect(courseScenery("point-walter")).toBe("river");
    expect(courseScenery("karratha")).toBe("red-earth");
    expect(courseScenery("new-course")).toBe("parkland");
  });

  it("shortens names for tight spaces", () => {
    expect(shortCourseName("Collier Park Golf Course")).toBe("Collier Park");
    expect(shortCourseName("Sun City Country Club")).toBe("Sun City");
    expect(shortCourseName("Links Kennedy Bay")).toBe("Links Kennedy Bay");
  });

  it("knows every course in the seed data", async () => {
    const { createDb, seed } = await import("@bookon/db");
    const handle = createDb("pglite:memory");
    await handle.migrate();
    await seed(handle.db);
    const slugs = (await listCourseDetails(handle.db)).map((c) => c.slug);
    await handle.close();
    const placedByDefault = slugs.filter(
      (s) => courseArea(s) === "Perth" && courseScenery(s) === "parkland",
    );
    // Only these are Perth parkland on purpose; anything else here was forgotten.
    expect(placedByDefault.sort()).toEqual(
      ["fremantle-public", "hamersley", "kwinana", "rockingham"].sort(),
    );
    // Starting a database takes a few seconds when every package's tests run at once.
  }, 30_000);
});
