/**
 * The areas courses are grouped into, for the courses page and the search.
 * Each course's area is stored on the course and admins can change it.
 */
export const AREAS = [
  { id: "north", name: "North" },
  { id: "east", name: "East" },
  { id: "south", name: "South" },
  { id: "west", name: "West" },
  { id: "regional", name: "Regional WA" },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];

export function isAreaId(value: unknown): value is AreaId {
  return AREAS.some((a) => a.id === value);
}

/** The area's name, or "Other" for a course not given one yet. */
export function areaName(id: string | null | undefined): string {
  return AREAS.find((a) => a.id === id)?.name ?? "Other";
}

/**
 * How far "near me" reaches, in km (Milestone 28), for the search and alerts.
 * 100 km at most keeps regional courses like Albany out of Perth searches.
 */
export const NEAR_DISTANCES_KM = [10, 20, 30, 50, 75, 100] as const;
export type NearDistance = (typeof NEAR_DISTANCES_KM)[number];
export const DEFAULT_NEAR_KM: NearDistance = 30;

export function isNearDistance(value: unknown): value is NearDistance {
  return (NEAR_DISTANCES_KM as readonly unknown[]).includes(value);
}

export interface LatLon {
  latitude: number;
  longitude: number;
}

/** Straight-line distance in kilometres. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "800 m", "6 km", "120 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km < 10 ? Math.round(km * 10) / 10 : Math.round(km)} km`;
}
