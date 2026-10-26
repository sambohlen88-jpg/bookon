// Kept apart from search-form.ts so the Near me button (a client component) doesn't pull in server code.
import { NEAR_DISTANCES_KM } from "@bookon/core/areas";

/** Distances golfers can limit a Near me search to, in km (the same as alerts, Milestone 28). */
export const WITHIN_OPTIONS = NEAR_DISTANCES_KM;

export interface Near {
  latitude: number;
  longitude: number;
  /** Only courses this close, or null to just sort by distance. */
  within: (typeof WITHIN_OPTIONS)[number] | null;
}
