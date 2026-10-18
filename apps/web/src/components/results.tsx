import Link from "next/link";
import { formatAgo, formatPerthDay, formatPerthTime, formatPrice } from "@bookon/core";
import type { CheckProblem, CourseResult, DayNotice, ResultTeeTime } from "@bookon/db";
import { PROBLEM_LABEL, PROBLEM_SENTENCE } from "@/lib/check-problems";
import { toggleFavourite } from "@/app/actions";
import { CourseArt } from "@/components/course-art";

/**
 * Keep pages light on mobile data: a two week search can match 18,000 times.
 * One day shows 6 per course with up to 10 more folded away; longer searches
 * show 4 per course per day, for the first 3 days with times when several
 * courses are listed. Beyond that, link to that course, where every time is
 * listed (one course rarely has more than 200 in a day).
 */
const LIMITS = {
  multiDay: { visible: 4, max: 4 },
  singleDay: { visible: 6, max: 16 },
  oneCourseOneDay: { visible: 6, max: Infinity },
};
/** Days listed per course in a multi-day search across several courses. */
const DAYS_PER_COURSE = 3;

export function CourseResults({
  result,
  multiDay,
  oneCourse,
  now,
  favourite,
  back,
  dayHref,
  courseHref,
  bookHref,
  photoId = null,
}: {
  result: CourseResult;
  multiDay: boolean;
  oneCourse: boolean;
  now: Date;
  /** Whether the golfer has starred this course, or null when signed out. */
  favourite: boolean | null;
  /** This search, to come back to after starring or signing in. */
  back: string;
  /** A search for just this course on one day, for "see all" links. */
  dayHref: (date: string) => string;
  /** The same search for just this course, for "more days" links. */
  courseHref: string;
  /** The course's approved photo, if the club supplied one. */
  photoId?: string | null;
  /** The tracked /go link for a tee time. */
  bookHref: (teeTime: ResultTeeTime) => string;
}) {
  const limits = multiDay ? LIMITS.multiDay : oneCourse ? LIMITS.oneCourseOneDay : LIMITS.singleDay;
  const { course, teeTimes, checkedAt, notices } = result;
  const headingId = `course-${course.slug}`;
  const byDay = [...groupByDay(teeTimes)];
  const shownDays = multiDay && !oneCourse ? byDay.slice(0, DAYS_PER_COURSE) : byDay;
  const hiddenDays = byDay.slice(shownDays.length);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-background p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <CourseArt
          slug={course.slug}
          photoId={photoId}
          className="hidden h-16 w-28 shrink-0 overflow-hidden rounded-lg lg:block"
        />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-lg font-semibold leading-tight">
            <Link href={`/courses/${course.slug}`} prefetch={false} className="hover:text-brand">
              {course.name}
            </Link>
          </h2>
          <p className="text-sm text-muted">{course.suburb}</p>
          {checkedAt && (
            <p className="mt-1 text-xs text-muted">
              <time dateTime={checkedAt.toISOString()}>Checked {formatAgo(checkedAt, now)}</time>
            </p>
          )}
        </div>
        <FavouriteStar courseId={course.id} name={course.name} on={favourite} back={back} />
      </div>

      <Notices notices={notices} now={now} />

      {teeTimes.length === 0 && notices.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          {result.fullyBooked
            ? "Fully booked: the club has no public times free."
            : "No times here match your search."}
        </p>
      )}

      {shownDays.map(([day, times]) => (
        <div key={day} className="mt-3">
          {multiDay && <h3 className="text-sm font-semibold">{formatPerthDay(day)}</h3>}
          <ul className="tee-list">
            {times.slice(0, limits.visible).map((t) => (
              <TeeTimeRow
                key={`${t.startTime.toISOString()}-${t.holes}-${t.layout}`}
                teeTime={t}
                course={course.name}
                href={bookHref(t)}
              />
            ))}
          </ul>
          {times.length > limits.visible && limits.max > limits.visible && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand">
                Show {Math.min(times.length, limits.max) - limits.visible} more
              </summary>
              <ul className="tee-list">
                {times.slice(limits.visible, limits.max).map((t) => (
                  <TeeTimeRow
                    key={`${t.startTime.toISOString()}-${t.holes}-${t.layout}`}
                    teeTime={t}
                    course={course.name}
                    href={bookHref(t)}
                  />
                ))}
              </ul>
            </details>
          )}
          {times.length > limits.max && (
            <Link href={dayHref(day)} prefetch={false} className="more-link">
              See all {times.length} times{multiDay ? ` on ${formatPerthDay(day)}` : ""}
            </Link>
          )}
        </div>
      ))}
      {hiddenDays.length > 0 && (
        <Link href={courseHref} prefetch={false} className="more-link">
          {hiddenDays.reduce((n, [, times]) => n + times.length, 0)} more times on{" "}
          {hiddenDays.length} more {hiddenDays.length === 1 ? "day" : "days"}
        </Link>
      )}
    </section>
  );
}

const starClass =
  "-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none";

/** Star a course to find it fast. Signed out, the star leads to sign in. */
function FavouriteStar({
  courseId,
  name,
  on,
  back,
}: {
  courseId: string;
  name: string;
  on: boolean | null;
  back: string;
}) {
  if (on === null) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(back)}`}
        prefetch={false}
        aria-label={`Sign in to save ${name} to My courses`}
        className={`${starClass} text-muted`}
      >
        <span aria-hidden>☆</span>
      </Link>
    );
  }
  return (
    <form action={toggleFavourite}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <input type="hidden" name="back" value={back} />
      <button
        type="submit"
        aria-pressed={on}
        aria-label={`Save ${name} to My courses`}
        className={`${starClass} ${on ? "text-star" : "text-muted"}`}
      >
        <span aria-hidden>{on ? "★" : "☆"}</span>
      </button>
    </form>
  );
}

function TeeTimeRow({
  teeTime,
  course,
  href,
}: {
  teeTime: ResultTeeTime;
  course: string;
  href: string;
}) {
  const time = formatPerthTime(teeTime.startTime);
  const spots = `${teeTime.spotsAvailable} ${teeTime.spotsAvailable === 1 ? "spot" : "spots"}`;
  return (
    // Short class names: a results page can list hundreds of these (styles in globals.css).
    <li className="tee-row">
      <span className="tee-time">{time}</span>
      <span className="tee-info">
        <span>
          {teeTime.holes} holes{teeTime.layout ? ` · ${teeTime.layout}` : ""}
        </span>
        <span className="text-muted">
          {spots} ·{" "}
          {teeTime.priceCents === null ? "Price at club" : formatPrice(teeTime.priceCents)}
        </span>
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        aria-label={`Book ${time} at ${course} (opens the club's site)`}
        className="tee-book"
      >
        Book
      </a>
    </li>
  );
}

function Notices({ notices, now }: { notices: DayNotice[]; now: Date }) {
  if (notices.length === 0) return null;
  const stale = notices.filter((n) => n.kind === "stale" || n.kind === "not-checked");
  const notOpen = notices.filter(
    (n): n is Extract<DayNotice, { kind: "not-open" }> => n.kind === "not-open",
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      {stale.length > 0 && (
        <p
          role="status"
          className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg"
        >
          {staleMessage(stale, now)}
        </p>
      )}
      {notOpen.length > 0 && (
        <p className="rounded-lg border border-info-border bg-info-bg px-3 py-2 text-sm text-info-fg">
          {notOpenMessage(notOpen)}
        </p>
      )}
    </div>
  );
}

function notOpenMessage(notices: Extract<DayNotice, { kind: "not-open" }>[]): string {
  const first = notices[0]!;
  const daysAhead = daysBetween(first.opensOn, first.date);
  const when = `This club releases times ${daysAhead} days ahead`;
  return notices.length === 1
    ? `Times for ${formatPerthDay(first.date)} aren't out yet. ${when}, so expect them around ${formatPerthDay(first.opensOn)}.`
    : `Times for ${dayList(notices.map((n) => n.date))} aren't out yet. ${when}, so the first should appear around ${formatPerthDay(first.opensOn)}.`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The most common problem among a course's unchecked days. */
function mainProblem(notices: DayNotice[]): CheckProblem | null {
  const counts = new Map<CheckProblem, number>();
  for (const n of notices)
    if (n.kind === "stale") counts.set(n.problem, (counts.get(n.problem) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function staleMessage(notices: DayNotice[], now: Date): string {
  const days = dayList(notices.map((n) => n.date));
  const problem = mainProblem(notices);
  const lastSuccess = notices
    .map((n) => (n.kind === "stale" ? n.lastSuccessAt : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!problem) return `We haven't been able to check ${days} yet.`;
  const last = lastSuccess ? ` Last checked ${formatAgo(lastSuccess, now)}.` : "";
  return `We couldn't check ${days}: ${PROBLEM_SENTENCE[problem]}. You can still book on the club's site.${last}`;
}

/** "Sun 18 Oct", "Sun 18 Oct and Mon 19 Oct", or "Sun 18 Oct to Sat 24 Oct". */
function dayList(dates: string[]): string {
  if (dates.length === 1) return formatPerthDay(dates[0]!);
  if (dates.length === 2) return `${formatPerthDay(dates[0]!)} and ${formatPerthDay(dates[1]!)}`;
  return `${formatPerthDay(dates[0]!)} to ${formatPerthDay(dates.at(-1)!)}`;
}

function groupByDay(teeTimes: ResultTeeTime[]): Map<string, ResultTeeTime[]> {
  const days = new Map<string, ResultTeeTime[]>();
  for (const t of teeTimes) {
    const list = days.get(t.playDate) ?? [];
    list.push(t);
    days.set(t.playDate, list);
  }
  return days;
}

/** One line per course that had nothing matching, so a 26 course search stays short. */
export function NoMatchList({
  results,
  now,
  others,
  clubHref,
}: {
  results: CourseResult[];
  now: Date;
  others: boolean;
  /** The club's own booking page (tracked), for courses we couldn't check. */
  clubHref: (result: CourseResult) => string;
}) {
  const statuses = new Map(results.map((r) => [r.course.id, courseStatus(r, now)]));
  const count = (group: Status["group"]) =>
    [...statuses.values()].filter((s) => s.group === group).length;
  const unchecked = count("unchecked");
  const breakdown = [
    count("booked") > 0 ? `${count("booked")} fully booked` : null,
    count("none") > 0 ? `${count("none")} nothing matching` : null,
    count("not-out") > 0 ? `${count("not-out")} not out yet` : null,
    unchecked > 0 ? `${unchecked} couldn't check` : null,
  ].filter(Boolean);
  return (
    <details className="rounded-xl border border-border bg-background">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 text-sm font-medium">
        {unchecked === results.length ? (
          `Couldn't check ${results.length} ${results.length === 1 ? "course" : "courses"}`
        ) : (
          <span>
            No times at {results.length} {others ? "other " : ""}
            {results.length === 1 ? "course" : "courses"}
            {breakdown.length > 1 && (
              <span className="block font-normal text-muted">{breakdown.join(" · ")}</span>
            )}
          </span>
        )}
      </summary>
      <ul className="border-t border-border px-4">
        {results.map((r) => (
          <li
            key={r.course.id}
            className="flex items-baseline justify-between gap-3 border-t border-border py-3 text-sm first:border-t-0"
          >
            <span>
              {r.course.name} <span className="text-muted">· {r.course.suburb}</span>
            </span>
            <span className="shrink-0 text-right text-xs">
              <span
                className={statuses.get(r.course.id)!.problem ? "text-warning-fg" : "text-muted"}
              >
                {statuses.get(r.course.id)!.label}
              </span>
              {statuses.get(r.course.id)!.group === "unchecked" && (
                <a
                  href={clubHref(r)}
                  target="_blank"
                  rel="noopener"
                  className="block font-medium text-brand underline"
                >
                  Try the club&apos;s site
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

type Status = {
  label: string;
  problem: boolean;
  group: "booked" | "none" | "unchecked" | "not-out";
};

/** Why a course has nothing to show: booked out, nothing matching, not out yet, or not checked. */
function courseStatus(result: CourseResult, now: Date): Status {
  const problem = mainProblem(result.notices);
  if (problem) return { label: PROBLEM_LABEL[problem], problem: true, group: "unchecked" };
  if (result.notices.some((n) => n.kind === "not-checked"))
    return { label: "Not checked yet", problem: true, group: "unchecked" };
  if (result.fullyBooked) return { label: "Fully booked", problem: false, group: "booked" };
  if (result.checkedAt)
    return {
      label: `Nothing matching · checked ${formatAgo(result.checkedAt, now)}`,
      problem: false,
      group: "none",
    };
  if (result.notices.every((n) => n.kind === "not-open"))
    return { label: "Times not out yet", problem: false, group: "not-out" };
  return { label: "", problem: false, group: "none" };
}
