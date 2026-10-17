import type { Course, DateRange, TeeTime } from "./types";

/** Minimal HTTP interface adapters fetch through, so tests can serve fixtures. */
export interface HttpClient {
  getText(url: string): Promise<string>;
}

export interface FetchContext {
  http: HttpClient;
}

/** Availability for one Perth date. A date is only reported once every page for it was read. */
export interface DayAvailability {
  date: string;
  teeTimes: TeeTime[];
}

/**
 * Every booking platform implements this interface. Phase 2 may add optional
 * `book()` and `cancel()` methods, so keep callers from assuming this is the
 * full shape.
 */
export interface CourseAdapter {
  readonly platform: Course["platform"];

  /**
   * Read public availability for each date in the range. Throws if the
   * platform cannot be read, so the caller can record the failure rather
   * than store an empty day.
   */
  fetchAvailability(
    course: Course,
    range: DateRange,
    ctx: FetchContext,
  ): Promise<DayAvailability[]>;

  /** Best link to the club's own booking page for this slot. */
  buildBookingUrl(course: Course, teeTime: TeeTime): string;
}
