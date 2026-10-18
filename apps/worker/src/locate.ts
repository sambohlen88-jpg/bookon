/**
 * Find where each course is on OpenStreetMap, for "Near me" and the weather.
 *
 *   pnpm courses:locate              look up courses with no location, and print what was found
 *   pnpm courses:locate -- --all     look up every course again
 *   pnpm courses:locate -- --save    also save the locations (check the printed list first)
 *
 * Uses OpenStreetMap's Nominatim search, which allows light use like this
 * (https://operations.osmfoundation.org/policies/nominatim/): one request a
 * second, with our name and contact in the user agent.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COURSE_LOCATIONS, createDb, listCourseLocations, setCourseLocation } from "@bookon/db";
import { loadConfig } from "./config";
import { courseLocationsFile, pickGolfCourse, placeLocation, type Place } from "./places";

const args = new Set(process.argv.slice(2));
const config = loadConfig();
const handle = createDb(config.databaseUrl);

async function search(query: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "au",
    limit: "5",
  }).toString();
  const response = await fetch(url, { headers: { "User-Agent": config.userAgent } });
  if (!response.ok) throw new Error(`HTTP ${response.status} from OpenStreetMap`);
  return (await response.json()) as Place[];
}

const pause = () => new Promise((r) => setTimeout(r, 1100));

try {
  await handle.migrate();
  const courses = (await listCourseLocations(handle.db)).filter(
    (c) => args.has("--all") || c.latitude === null,
  );
  if (courses.length === 0) console.log("Every course has a location. Use --all to look again.");
  const found = { ...COURSE_LOCATIONS };
  for (const course of courses) {
    await pause();
    let place = pickGolfCourse(await search(`${course.name}, ${course.suburb}, Western Australia`));
    if (!place) {
      // Clubs often go by a different name on the map.
      await pause();
      place = pickGolfCourse(await search(`golf, ${course.suburb}, Western Australia`));
    }
    if (!place) {
      console.log(`✗ ${course.name} (${course.suburb}): not found. Set it in admin instead.`);
      continue;
    }
    const location = placeLocation(place);
    console.log(`✓ ${course.name}: ${location.latitude}, ${location.longitude}`);
    console.log(`    ${place.display_name}\n    ${location.source}`);
    found[course.slug] = location;
    if (args.has("--save")) await setCourseLocation(handle.db, course.id, location);
  }
  if (args.has("--save")) {
    const file = new URL("../../../packages/db/src/course-locations.ts", import.meta.url);
    writeFileSync(fileURLToPath(file), courseLocationsFile(found));
    console.log("\nSaved, and written to packages/db/src/course-locations.ts.");
  } else if (courses.length > 0) {
    console.log("\nNothing saved yet. Check the links above, then run again with --save.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
