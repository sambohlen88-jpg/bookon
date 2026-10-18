/**
 * Booking platforms. `chronogolf` courses are listed but not searchable until
 * partner API access is arranged. `manual` = phone or walk-up only.
 */
export type Platform = "miclub" | "quick18" | "chronogolf" | "manual" | "ygb";

/** What a venue is: a golf course with tee times, or bays booked by the half hour. */
export type VenueKind = "course" | "simulator" | "range";

export interface Course {
  id: string;
  clubId: string;
  name: string;
  slug: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  holes: number;
  /** Missing means a golf course. */
  kind?: VenueKind;
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
  /** 9 or 18 for a course. 0 for a simulator or range bay, which is booked by time. */
  holes: number;
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
  /** Simulators and ranges: which bay, as the venue labels it. */
  bay?: string | null;
  /** Simulators and ranges: the session lengths, in minutes, that can start then. */
  durations?: number[] | null;
}

/** Inclusive range of Perth calendar dates, formatted YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}
