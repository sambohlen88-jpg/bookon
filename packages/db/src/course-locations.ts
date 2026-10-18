/**
 * Where each course is, from OpenStreetMap (© OpenStreetMap contributors,
 * ODbL), written by `pnpm courses:locate` and checked by a person. Used for
 * "Near me" and the weather. The seed only fills in courses that have no
 * location yet, so corrections made in admin stay.
 */
export interface CourseLocation {
  latitude: number;
  longitude: number;
  /** The OpenStreetMap feature it came from. */
  source: string;
}

export const COURSE_LOCATIONS: Record<string, CourseLocation> = {
  albany: {
    latitude: -35.01192,
    longitude: 117.91944,
    source: "https://www.openstreetmap.org/way/129938365",
  },
  broome: {
    latitude: -17.97762,
    longitude: 122.21869,
    source: "https://www.openstreetmap.org/way/173532435",
  },
  bunbury: {
    latitude: -33.30313,
    longitude: 115.71101,
    source: "https://www.openstreetmap.org/way/5028299",
  },
  busselton: {
    latitude: -33.69572,
    longitude: 115.36475,
    source: "https://www.openstreetmap.org/way/319645541",
  },
  capel: {
    latitude: -33.45404,
    longitude: 115.60139,
    source: "https://www.openstreetmap.org/way/13769686",
  },
  "collier-park": {
    latitude: -32.00113,
    longitude: 115.8807,
    source: "https://www.openstreetmap.org/way/5929275",
  },
  "dunsborough-lakes": {
    latitude: -33.62584,
    longitude: 115.11106,
    source: "https://www.openstreetmap.org/relation/3357583",
  },
  "fremantle-public": {
    latitude: -32.05268,
    longitude: 115.76821,
    source: "https://www.openstreetmap.org/way/336369278",
  },
  geraldton: {
    latitude: -28.77322,
    longitude: 114.63376,
    source: "https://www.openstreetmap.org/way/181426255",
  },
  hamersley: {
    latitude: -31.86653,
    longitude: 115.76849,
    source: "https://www.openstreetmap.org/way/4979763",
  },
  hartfield: {
    latitude: -32.00128,
    longitude: 116.00393,
    source: "https://www.openstreetmap.org/way/25178542",
  },
  "joondalup-resort": {
    latitude: -31.74749,
    longitude: 115.75006,
    source: "https://www.openstreetmap.org/relation/4298556",
  },
  karratha: {
    latitude: -20.7222,
    longitude: 116.85203,
    source: "https://www.openstreetmap.org/way/385349202",
  },
  "kennedy-bay": {
    latitude: -32.36715,
    longitude: 115.73974,
    source: "https://www.openstreetmap.org/way/1158723927",
  },
  kwinana: {
    latitude: -32.24654,
    longitude: 115.79705,
    source: "https://www.openstreetmap.org/way/8070629",
  },
  "lake-claremont": {
    latitude: -31.97744,
    longitude: 115.77961,
    source: "https://www.openstreetmap.org/way/438496706",
  },
  marangaroo: {
    latitude: -31.82644,
    longitude: 115.83148,
    source: "https://www.openstreetmap.org/way/8109327",
  },
  "margaret-river": {
    latitude: -33.9714,
    longitude: 115.01733,
    source: "https://www.openstreetmap.org/way/83021440",
  },
  maylands: {
    latitude: -31.9456,
    longitude: 115.9011,
    source: "https://www.openstreetmap.org/way/24840179",
  },
  "meadow-springs": {
    latitude: -32.50251,
    longitude: 115.74633,
    source: "https://www.openstreetmap.org/relation/4298420",
  },
  pinjarra: {
    latitude: -32.61553,
    longitude: 115.85958,
    source: "https://www.openstreetmap.org/way/49911322",
  },
  "point-walter": {
    latitude: -32.01908,
    longitude: 115.78985,
    source: "https://www.openstreetmap.org/way/8823444",
  },
  rockingham: {
    latitude: -32.30053,
    longitude: 115.77387,
    source: "https://www.openstreetmap.org/way/19830263",
  },
  "secret-harbour": {
    latitude: -32.41257,
    longitude: 115.76416,
    source: "https://www.openstreetmap.org/relation/4017008",
  },
  "sun-city": {
    latitude: -31.54111,
    longitude: 115.65299,
    source: "https://www.openstreetmap.org/way/1463945496",
  },
  "the-cut": {
    latitude: -32.61166,
    longitude: 115.62904,
    source: "https://www.openstreetmap.org/relation/4238188",
  },
  "the-springs": {
    latitude: -32.15916,
    longitude: 115.95625,
    source: "https://www.openstreetmap.org/way/1288810070",
  },
  wembley: {
    latitude: -31.92736,
    longitude: 115.78079,
    source: "https://www.openstreetmap.org/way/24990515",
  },
  whaleback: {
    latitude: -32.05113,
    longitude: 115.92605,
    source: "https://www.openstreetmap.org/way/8051818",
  },
};
