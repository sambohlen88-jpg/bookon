import Link from "next/link";
import { RATING_MIN_COUNT, formatRating, ratingCount, type RatingSummary } from "@bookon/core";
import { rateCourse, removeMyRating } from "@/app/actions";

export { RatingBadge } from "@/components/rating-badge";

/** The course page's ratings: the average, and the golfer's own stars to set, change or remove. */
export function RateCourse({
  courseId,
  slug,
  name,
  summary,
  mine,
  signedIn,
}: {
  courseId: string;
  slug: string;
  name: string;
  summary: RatingSummary;
  /** The signed-in golfer's stars, if they've rated it. */
  mine: number | null;
  signedIn: boolean;
}) {
  return (
    <section id="rating" aria-labelledby="rating-heading" className="mt-8 scroll-mt-4">
      <h2 id="rating-heading" className="text-xl font-semibold">
        Ratings
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border p-4">
        <div>
          {summary.count >= RATING_MIN_COUNT ? (
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {formatRating(summary.average)}
              </span>
              <span className="text-star" aria-hidden>
                ★
              </span>
              <span className="text-sm text-muted">out of 5 from {ratingCount(summary.count)}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              {summary.count === 0
                ? "No ratings yet."
                : `Not rated yet: the average shows once ${RATING_MIN_COUNT} golfers have rated it (${summary.count} so far).`}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {signedIn ? (
            <>
              <form action={rateCourse} className="flex items-center gap-2">
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="slug" value={slug} />
                <span className="text-sm font-medium">{mine ? "Your rating" : "Rate it"}</span>
                <span className="rate-stars flex" role="group" aria-label={`Rate ${name}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="submit"
                      name="stars"
                      value={n}
                      data-on={mine && n <= mine ? "" : undefined}
                      aria-label={`${n} out of 5${mine === n ? " (your rating)" : ""}`}
                      aria-pressed={mine === n}
                      className="rate-star min-h-11 min-w-9 text-2xl leading-none"
                    >
                      ★
                    </button>
                  ))}
                </span>
              </form>
              {mine && (
                <form action={removeMyRating}>
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="slug" value={slug} />
                  <button type="submit" className="text-sm font-medium text-brand">
                    Remove my rating
                  </button>
                </form>
              )}
            </>
          ) : (
            <Link
              href={`/signin?next=${encodeURIComponent(`/courses/${slug}#rating`)}`}
              className="text-sm font-medium text-brand"
            >
              Sign in to rate {name}
            </Link>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Ratings are from golfers signed in to BookOn, one each. Names aren&apos;t shown.
      </p>
    </section>
  );
}
