import type { CourseLocation } from "@bookon/db";

/** One OpenStreetMap Nominatim search result (format=jsonv2). */
export interface Place {
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  display_name: string;
  osm_type: string;
  osm_id: number;
}

/** The golf course among the search results, if there is one. */
export function pickGolfCourse(places: Place[]): Place | null {
  return (
    places.find((p) => p.category === "leisure" && p.type === "golf_course") ??
    places.find((p) => /golf/i.test(p.display_name)) ??
    null
  );
}

export function placeLocation(place: Place): CourseLocation {
  return {
    latitude: Number(Number(place.lat).toFixed(5)),
    longitude: Number(Number(place.lon).toFixed(5)),
    source: `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
  };
}

/** The contents of packages/db/src/course-locations.ts for these locations. */
export function courseLocationsFile(locations: Record<string, CourseLocation>): string {
  const entries = Object.keys(locations)
    .sort()
    .map((slug) => {
      const l = locations[slug]!;
      return [
        `  ${JSON.stringify(slug)}: {`,
        `    latitude: ${l.latitude},`,
        `    longitude: ${l.longitude},`,
        `    source: ${JSON.stringify(l.source)},`,
        `  },`,
      ].join("\n");
    });
  return `/**
 * Where each course is, from OpenStreetMap (© OpenStreetMap contributors,
 * ODbL), written by \`pnpm courses:locate\` and checked by a person. Used for
 * "Near me" and the weather. The seed only fills in courses that have no
 * location yet, so corrections made in admin stay.
 */
export interface CourseLocation {
  latitude: number;
  longitude: number;
  /** The OpenStreetMap feature it came from. */
  source: string;
}

export const COURSE_LOCATIONS: Record<string, CourseLocation> = {${entries.length ? `\n${entries.join("\n")}\n` : ""}};
`;
}
