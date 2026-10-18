import Link from "next/link";
import { formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import type { CourseResult } from "@bookon/db";
import { bookLink } from "@/lib/click-token";
import { shortCourseName } from "@/lib/course-info";

/** The first time at each course, earliest first. */
export function firstTimes(results: CourseResult[], limit: number) {
  return results
    .filter((r) => r.teeTimes.length > 0)
    .map((r) => ({ result: r, time: r.teeTimes[0]! }))
    .sort((a, b) => a.time.startTime.getTime() - b.time.startTime.getTime())
    .slice(0, limit);
}

/** "Who can play this arvo?": the next free time at the nearest few courses to tee off. */
export function FreeSoon({
  results,
  now,
  players,
  title = "Free soon",
  seeAll,
  limit = 6,
}: {
  results: CourseResult[];
  now: Date;
  players: number;
  title?: string;
  seeAll: string;
  limit?: number;
}) {
  const rows = firstTimes(results, limit);
  if (rows.length === 0) return null;
  const today = perthDate(now);
  return (
    <section aria-labelledby="free-soon">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="free-soon" className="text-lg font-semibold lg:text-2xl lg:font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted">
            The next free time at each course for {players} {players === 1 ? "player" : "players"}.
          </p>
        </div>
        <Link href={seeAll} className="min-h-11 shrink-0 py-3 text-sm font-semibold text-brand">
          See all
        </Link>
      </div>
      <ul className="mt-3 overflow-hidden rounded-xl border border-border lg:grid lg:grid-cols-2">
        {rows.map(({ result, time }) => (
          <li
            key={result.course.id}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 lg:[&:nth-child(2)]:border-t-0"
          >
            <span className="w-20 shrink-0">
              <span className="block text-lg font-semibold tabular-nums">
                {formatPerthTime(time.startTime)}
              </span>
              <span className="block text-xs text-muted">
                {time.playDate === today ? "Today" : "Tomorrow"}
              </span>
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <Link href={`/courses/${result.course.slug}`} className="block truncate font-medium">
                {shortCourseName(result.course.name)}
              </Link>
              <span className="block text-muted">
                {time.holes} holes ·{" "}
                {time.priceCents === null ? "Price at club" : formatPrice(time.priceCents)}
              </span>
            </span>
            <a
              href={bookLink({
                courseId: result.course.id,
                startTime: time.startTime.toISOString(),
                url: time.bookingUrl,
                source: "search",
              })}
              target="_blank"
              rel="noopener"
              aria-label={`Book ${formatPerthTime(time.startTime)} at ${result.course.name} (opens the club's site)`}
              className="tee-book"
            >
              Book
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
