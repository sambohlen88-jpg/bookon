import { describe, expect, it } from "vitest";
import { COURSE_LOCATIONS } from "@bookon/db";
import { courseLocationsFile, pickGolfCourse, placeLocation, type Place } from "./places";

const place = (overrides: Partial<Place>): Place => ({
  lat: "-32.0",
  lon: "115.9",
  display_name: "Somewhere, Western Australia",
  osm_type: "way",
  osm_id: 1,
  ...overrides,
});

describe("course locations", () => {
  it("prefers a mapped golf course, then anything named golf", () => {
    const road = place({ category: "highway", type: "residential", display_name: "Golf Road" });
    const course = place({ category: "leisure", type: "golf_course", osm_id: 42 });
    expect(pickGolfCourse([road, course])).toBe(course);
    expect(pickGolfCourse([place({}), road])).toBe(road);
    expect(pickGolfCourse([place({})])).toBeNull();
  });

  it("keeps five decimals (about a metre) and the map link", () => {
    expect(placeLocation(place({ lat: "-32.0012345", lon: "115.8712349", osm_id: 42 }))).toEqual({
      latitude: -32.00123,
      longitude: 115.87123,
      source: "https://www.openstreetmap.org/way/42",
    });
  });

  it("writes a file the seed can read", () => {
    const text = courseLocationsFile({
      whaleback: {
        latitude: -32.05,
        longitude: 115.9,
        source: "https://www.openstreetmap.org/way/1",
      },
    });
    expect(text).toContain('  "whaleback": {\n    latitude: -32.05,');
    expect(courseLocationsFile({})).toContain(
      "COURSE_LOCATIONS: Record<string, CourseLocation> = {};",
    );
    expect(COURSE_LOCATIONS).toBeTypeOf("object");
  });
});
