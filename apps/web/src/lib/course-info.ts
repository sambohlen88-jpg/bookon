/**
 * Website-only details about courses: which part of WA they're in, and the
 * kind of country they sit in, for the illustrations. Not used by search.
 */

export type Area =
  "Perth" | "Peel" | "South West" | "Great Southern" | "Mid West" | "Pilbara and Kimberley";

export const AREAS: Area[] = [
  "Perth",
  "Peel",
  "South West",
  "Great Southern",
  "Mid West",
  "Pilbara and Kimberley",
];

/** What an illustration shows. It's a feel for the place, not a picture of the course. */
export type Scenery = "parkland" | "bush" | "coast" | "river" | "lakes" | "red-earth" | "red-coast";

const INFO: Record<string, { area: Area; scenery: Scenery }> = {
  hamersley: { area: "Perth", scenery: "parkland" },
  "fremantle-public": { area: "Perth", scenery: "parkland" },
  whaleback: { area: "Perth", scenery: "bush" },
  "collier-park": { area: "Perth", scenery: "bush" },
  marangaroo: { area: "Perth", scenery: "bush" },
  "point-walter": { area: "Perth", scenery: "river" },
  maylands: { area: "Perth", scenery: "river" },
  hartfield: { area: "Perth", scenery: "bush" },
  "joondalup-resort": { area: "Perth", scenery: "lakes" },
  "sun-city": { area: "Perth", scenery: "bush" },
  kwinana: { area: "Perth", scenery: "parkland" },
  rockingham: { area: "Perth", scenery: "parkland" },
  "secret-harbour": { area: "Perth", scenery: "coast" },
  "kennedy-bay": { area: "Perth", scenery: "coast" },
  "the-cut": { area: "Peel", scenery: "coast" },
  "meadow-springs": { area: "Peel", scenery: "lakes" },
  pinjarra: { area: "Peel", scenery: "river" },
  bunbury: { area: "South West", scenery: "parkland" },
  capel: { area: "South West", scenery: "bush" },
  busselton: { area: "South West", scenery: "coast" },
  "dunsborough-lakes": { area: "South West", scenery: "lakes" },
  "margaret-river": { area: "South West", scenery: "bush" },
  albany: { area: "Great Southern", scenery: "coast" },
  geraldton: { area: "Mid West", scenery: "coast" },
  karratha: { area: "Pilbara and Kimberley", scenery: "red-earth" },
  broome: { area: "Pilbara and Kimberley", scenery: "red-coast" },
};

export function courseArea(slug: string): Area {
  return INFO[slug]?.area ?? "Perth";
}

export function courseScenery(slug: string): Scenery {
  return INFO[slug]?.scenery ?? "parkland";
}

/** "Collier Park" from "Collier Park Golf Course", for tight spaces. */
export function shortCourseName(name: string): string {
  return name.replace(
    / (Golf (Course|Club|Links)|Country Club|Golf & Country Club|Resort Golf)$/,
    "",
  );
}
