import type { Course, DateRange, TeeTime } from "./types";

/**
 * Every booking platform implements this interface.
 *
 * Draft only: no adapter may be written until docs/platforms.md shows the
 * platform's public availability can be read with permission (SPEC section 6).
 * Phase 2 may add optional `book()` and `cancel()` methods, so keep callers
 * from assuming this is the full shape.
 */
export interface CourseAdapter {
  readonly platform: Course["platform"];

  /** Read public availability for each date in the range. Must respect the fetch rules in SPEC section 6. */
  fetchAvailability(course: Course, range: DateRange): Promise<TeeTime[]>;

  /**
   * Best link to the club's own booking page for this slot. Only pre-fills
   * date or time where the platform is verified to support it; otherwise
   * returns the course's plain booking URL.
   */
  buildBookingUrl(course: Course, teeTime: TeeTime): string;
}
