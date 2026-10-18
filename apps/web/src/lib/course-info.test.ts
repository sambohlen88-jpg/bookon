import { describe, expect, it } from "vitest";
import { listCourseDetails } from "@bookon/db";
import { courseScenery, shortCourseName } from "./course-info";

describe("course info", () => {
  it("picks scenery for the illustrations", () => {
    expect(courseScenery("point-walter")).toBe("river");
    expect(courseScenery("karratha")).toBe("red-earth");
    expect(courseScenery("new-course")).toBe("parkland");
    expect(courseScenery("lights-out-golf")).toBe("simulator");
  });

  it("shortens names for tight spaces", () => {
    expect(shortCourseName("Collier Park Golf Course")).toBe("Collier Park");
    expect(shortCourseName("Sun City Country Club")).toBe("Sun City");
    expect(shortCourseName("Links Kennedy Bay")).toBe("Links Kennedy Bay");
  });

  it("gives every seeded course an area and its own scenery", async () => {
    const { createDb, seed } = await import("@bookon/db");
    const handle = createDb("pglite:memory");
    await handle.migrate();
    await seed(handle.db);
    const courses = await listCourseDetails(handle.db);
    await handle.close();
    expect(courses.filter((c) => !c.area).map((c) => c.slug)).toEqual([]);
    const parklandByDefault = courses
      .map((c) => c.slug)
      .filter((s) => courseScenery(s) === "parkland");
    // Only these are parkland on purpose; anything else here was forgotten.
    expect(parklandByDefault.sort()).toEqual(
      ["bunbury", "fremantle-public", "hamersley", "kwinana", "rockingham"].sort(),
    );
    // Starting a database takes a few seconds when every package's tests run at once.
  }, 30_000);
});
