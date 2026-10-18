// Kept apart from search-form.ts so the Near me button (a client component) doesn't pull in server code.

/** Distances golfers can limit a Near me search to, in km. */
export const WITHIN_OPTIONS = [10, 20, 40] as const;

export interface Near {
  latitude: number;
  longitude: number;
  /** Only courses this close, or null to just sort by distance. */
  within: (typeof WITHIN_OPTIONS)[number] | null;
}
