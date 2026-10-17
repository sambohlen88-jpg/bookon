/** Booking platforms we plan to support. `manual` = phone or walk-up only, listed but not searchable. */
export type Platform = "miclub" | "quick18" | "manual";

export interface Course {
  id: string;
  name: string;
  slug: string;
  suburb: string;
  latitude: number;
  longitude: number;
  holes: number;
  platform: Platform;
  /** Platform-specific settings, e.g. a MiClub booking resource id. Shape is owned by each adapter. */
  platformConfig: Record<string, unknown>;
  websiteUrl: string;
  bookingUrl: string;
  enabled: boolean;
  notes?: string;
}

/** One bookable slot as reported by a course's booking platform. */
export interface TeeTime {
  courseId: string;
  /** UTC instant. Convert with the helpers in `time.ts` for display. */
  startTime: Date;
  spotsAvailable: number;
  /** Null when the platform does not expose a public price. */
  priceCents: number | null;
  /** The page the data was read from, kept for auditing. */
  sourceUrl: string;
}

/** Inclusive range of Perth calendar dates, formatted YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}
