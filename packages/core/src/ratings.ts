/**
 * Course ratings (Milestone 20): signed-in golfers rate a course 1 to 5
 * stars. The average only shows once a course has RATING_MIN_COUNT ratings,
 * so one golfer's 1 or 5 doesn't define a course.
 */

export const RATING_MIN_COUNT = 3;

export interface RatingSummary {
  /** Unrounded. */
  average: number;
  count: number;
}

/** Whether there are enough ratings to show the average. */
export function ratingShown(summary: RatingSummary | null | undefined): summary is RatingSummary {
  return Boolean(summary && summary.count >= RATING_MIN_COUNT);
}

/** "4.3". */
export function formatRating(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1);
}

/** "27 ratings", "1 rating". */
export function ratingCount(count: number): string {
  return `${count} ${count === 1 ? "rating" : "ratings"}`;
}

export function validStars(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}
