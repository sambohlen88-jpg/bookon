/**
 * Website-only details about courses: the kind of country they sit in, for
 * the illustrations. Areas are stored on each course (packages/core/src/areas.ts).
 */

/** What an illustration shows. It's a feel for the place, not a picture of the course. */
export type Scenery = "parkland" | "bush" | "coast" | "river" | "lakes" | "red-earth" | "red-coast";

const SCENERY: Record<string, Scenery> = {
  hamersley: "parkland",
  "fremantle-public": "parkland",
  whaleback: "bush",
  "collier-park": "bush",
  marangaroo: "bush",
  "point-walter": "river",
  maylands: "river",
  hartfield: "bush",
  "joondalup-resort": "lakes",
  "sun-city": "bush",
  kwinana: "parkland",
  rockingham: "parkland",
  "secret-harbour": "coast",
  "kennedy-bay": "coast",
  "the-cut": "coast",
  "meadow-springs": "lakes",
  pinjarra: "river",
  bunbury: "parkland",
  capel: "bush",
  busselton: "coast",
  "dunsborough-lakes": "lakes",
  "margaret-river": "bush",
  albany: "coast",
  geraldton: "coast",
  karratha: "red-earth",
  broome: "red-coast",
};

export function courseScenery(slug: string): Scenery {
  return SCENERY[slug] ?? "parkland";
}

/** "Collier Park" from "Collier Park Golf Course", for tight spaces. */
export function shortCourseName(name: string): string {
  return name.replace(
    / (Golf (Course|Club|Links)|Country Club|Golf & Country Club|Resort Golf)$/,
    "",
  );
}
