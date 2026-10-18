import type { Metadata } from "next";
import Link from "next/link";
import { formatAgo, formatPerthDay, formatPrice } from "@bookon/core";
import {
  searchTeeTimes,
  shareByCode,
  sharedTimeKey,
  sharedTimeStatuses,
  type SharedCourse,
  type SharedTeeTime,
  type SharedTimeStatus,
} from "@bookon/db";
import { ShareButton } from "@/components/share-button";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton } from "@/components/ui";
import { bookLink } from "@/lib/click-token";
import { getDb } from "@/lib/db";
import {
  priceSummary,
  shareDetails,
  shareText,
  shareTime,
  shareTitle,
  timesByDay,
} from "@/lib/share";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Times listed per day before "show more". */
const VISIBLE = 6;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const share = await shareByCode(getDb(), code, new Date());
  const robots = { index: false, follow: false };
  if (!share) return { title: "Share expired · BookOn", robots };
  const courses = share.courses.length;
  const description = `${share.totalTeeTimes} ${share.totalTeeTimes === 1 ? "time" : "times"} at ${courses} ${courses === 1 ? "course" : "courses"}, shared from BookOn. ${shareDetails(share.params)}.`;
  return {
    title: `${shareTitle(share.params)} · BookOn`,
    description,
    robots,
    openGraph: { title: shareTitle(share.params), description, siteName: "BookOn" },
  };
}

export default async function SharePage({ params }: Props) {
  const { code } = await params;
  const db = getDb();
  const now = new Date();
  const share = await shareByCode(db, code, now);

  if (!share) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 pb-16 pt-8">
          <h1 className="text-2xl font-bold tracking-tight">These times have expired</h1>
          <p className="mt-2 text-muted">
            Shared times stop working a week after the day. Search for the latest ones instead.
          </p>
          <Link href="/" className={`${primaryButton} mt-6`}>
            Find a tee time
          </Link>
        </main>
      </>
    );
  }

  const current = await searchTeeTimes(
    db,
    { ...share.params, courseSlugs: share.courses.map((c) => c.slug) },
    now,
  );
  const statuses = sharedTimeStatuses(share, current, now);
  const all = [...statuses.values()];
  const gone = all.filter((s) => s === "gone").length;
  const unknown = all.some((s) => s === "unknown");
  const url = `${await siteOrigin()}/s/${share.code}`;
  const multiDay = share.params.dateFrom !== share.params.dateTo;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-16 pt-6 lg:max-w-3xl lg:px-6 lg:pt-10">
        <p className="text-sm font-semibold text-brand">Shared with you</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
          {shareTitle(share.params)}
        </h1>
        <p className="mt-1 text-muted">{shareDetails(share.params)}</p>
        <p className="mt-1 text-sm text-muted">
          These were free {formatAgo(share.createdAt, now)}. Book with the club before they go.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/search?${share.query}`} className={primaryButton}>
            See latest times
          </Link>
          <ShareButton
            ready={{
              code: share.code,
              url,
              title: shareTitle(share.params),
              text: shareText(share, url),
            }}
            label="Pass it on"
          />
        </div>

        {(gone > 0 || unknown) && (
          <div className="mt-4 flex flex-col gap-2">
            {gone > 0 && (
              <Notice tone="info">
                {gone === all.length
                  ? "These times have all gone. See the latest times for others."
                  : `${gone} of these ${gone === 1 ? "has" : "have"} gone since, and ${gone === 1 ? "is" : "are"} crossed out.`}
              </Notice>
            )}
            {unknown && (
              <Notice tone="warning">
                We couldn&apos;t check some clubs just now, so those times may have gone. The
                club&apos;s page has the final say.
              </Notice>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {share.courses.map((course) => (
            <SharedCourseCard
              key={course.id}
              course={course}
              multiDay={multiDay}
              statuses={statuses}
              courseHref={`/search?${share.query.replace(/&course=[^&]*/g, "")}&course=${course.slug}`}
            />
          ))}
        </div>

        <p className="mt-8 text-xs text-muted">
          Times and prices come from each club&apos;s booking page and can change. You book and pay
          with the club.
        </p>
      </main>
    </>
  );
}

function SharedCourseCard({
  course,
  multiDay,
  statuses,
  courseHref,
}: {
  course: SharedCourse;
  multiDay: boolean;
  statuses: Map<string, SharedTimeStatus>;
  courseHref: string;
}) {
  const price = priceSummary(course.teeTimes);
  const headingId = `course-${course.slug}`;
  const notStored = course.total - course.teeTimes.length;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-background p-4"
    >
      <h2 id={headingId} className="text-lg font-semibold leading-tight">
        <Link href={`/courses/${course.slug}`} prefetch={false} className="hover:text-brand">
          {course.name}
        </Link>
      </h2>
      <p className="text-sm text-muted">{price ? `${course.suburb} · ${price}` : course.suburb}</p>
      {timesByDay(course).map(([day, times]) => (
        <div key={day} className="mt-3">
          {multiDay && <h3 className="text-sm font-semibold">{formatPerthDay(day)}</h3>}
          <ul className="tee-list">
            {times.slice(0, VISIBLE).map((t) => (
              <SharedRow
                key={sharedTimeKey(course.id, t)}
                course={course}
                teeTime={t}
                status={statuses.get(sharedTimeKey(course.id, t)) ?? "unknown"}
              />
            ))}
          </ul>
          {times.length > VISIBLE && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brand">
                Show {times.length - VISIBLE} more
              </summary>
              <ul className="tee-list">
                {times.slice(VISIBLE).map((t) => (
                  <SharedRow
                    key={sharedTimeKey(course.id, t)}
                    course={course}
                    teeTime={t}
                    status={statuses.get(sharedTimeKey(course.id, t)) ?? "unknown"}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
      {notStored > 0 && (
        <Link href={courseHref} prefetch={false} className="more-link">
          {notStored} more times at {course.name}
        </Link>
      )}
    </section>
  );
}

function SharedRow({
  course,
  teeTime,
  status,
}: {
  course: SharedCourse;
  teeTime: SharedTeeTime;
  status: SharedTimeStatus;
}) {
  const time = shareTime(teeTime);
  const spots = `${teeTime.spotsAvailable} ${teeTime.spotsAvailable === 1 ? "spot" : "spots"}`;
  const isGone = status === "gone";
  return (
    <li className="tee-row">
      <span className={`tee-time ${isGone ? "text-muted line-through" : ""}`}>{time}</span>
      <span className="tee-info">
        <span className={isGone ? "text-muted" : ""}>{teeTime.holes} holes</span>
        <span className="text-muted">
          {isGone
            ? "Gone"
            : `${spots} · ${teeTime.priceCents === null ? "Price at club" : formatPrice(teeTime.priceCents)}`}
        </span>
      </span>
      {!isGone && (
        <a
          href={bookLink({
            courseId: course.id,
            startTime: teeTime.startTime,
            url: teeTime.bookingUrl,
            source: "share",
          })}
          target="_blank"
          rel="noopener"
          aria-label={`Book ${time} at ${course.name} (opens the club's site)`}
          className="tee-book"
        >
          Book
        </a>
      )}
    </li>
  );
}
