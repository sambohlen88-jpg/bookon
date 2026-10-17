/**
 * Booking platforms. `chronogolf` courses are listed but not searchable until
 * partner API access is arranged. `manual` = phone or walk-up only.
 */
export type Platform = "miclub" | "quick18" | "chronogolf" | "manual";

export interface Course {
  id: string;
  clubId: string;
  name: string;
  slug: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  holes: number;
  platform: Platform;
  /** Platform-specific settings, e.g. a MiClub booking resource id. Shape is owned by each adapter. */
  platformConfig: Record<string, unknown>;
  websiteUrl: string;
  bookingUrl: string;
  enabled: boolean;
  notes?: string | null;
}

/** One bookable slot as reported by a course's booking platform. */
export interface TeeTime {
  courseId: string;
  /** UTC instant. Convert with the helpers in `time.ts` for display. */
  startTime: Date;
  /** 9 or 18. Many Perth courses sell both from the same tee sheet. */
  holes: 9 | 18;
  /** Which nines or which course, as the club names it, e.g. "Old Course" or "Back 9 Morning". */
  layout: string | null;
  spotsAvailable: number;
  /** Smallest group the club accepts for this slot, e.g. 2 for "2 to 4 players". */
  minPlayers: number;
  /** Adult green fee. Null when the platform does not show one. */
  priceCents: number | null;
  /** The page the data was read from, kept for auditing. */
  sourceUrl: string;
  /** The most specific link to book this slot, when the platform has one. */
  bookingUrl: string | null;
}

/** Inclusive range of Perth calendar dates, formatted YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}
