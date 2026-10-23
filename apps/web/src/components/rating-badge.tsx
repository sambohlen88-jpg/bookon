// Only the ratings module: the rest of @bookon/core is server code, and the Courses page list runs in the browser.
import {
  RATING_MIN_COUNT,
  formatRating,
  ratingCount,
  ratingShown,
  type RatingSummary,
} from "@bookon/core/ratings";

/** "★ 4.3 (27)", or "Not rated yet" until a course has enough ratings (Milestone 20). */
export function RatingBadge({
  summary,
  className = "",
}: {
  summary: RatingSummary | null | undefined;
  className?: string;
}) {
  if (!ratingShown(summary))
    return (
      <span
        className={`text-sm text-muted ${className}`}
        title={`The average shows once ${RATING_MIN_COUNT} golfers have rated it`}
      >
        Not rated yet
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${className}`}
      aria-label={`Rated ${formatRating(summary.average)} out of 5 from ${ratingCount(summary.count)}`}
    >
      <span aria-hidden className="text-star">
        ★
      </span>
      <span className="font-semibold tabular-nums">{formatRating(summary.average)}</span>
      <span className="text-muted tabular-nums">({summary.count})</span>
    </span>
  );
}
