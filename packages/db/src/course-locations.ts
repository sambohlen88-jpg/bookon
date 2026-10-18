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

export const COURSE_LOCATIONS: Record<string, CourseLocation> = {};
