import type { Metadata } from "next";
import Link from "next/link";
import { formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import {
  alertByManageToken,
  alertFilters,
  latestAlertRound,
  listSearchableCourses,
  searchTeeTimes,
  type Alert,
  type Database,
} from "@bookon/db";
import { changeAlertByToken } from "@/app/actions";
import { AlertSummary } from "@/components/alert-summary";
import { SiteHeader } from "@/components/site-header";
import { primaryButton, secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your alert · BookOn", robots: { index: false } };

/**
 * Linked from every alert email and push notification, so golfers can see
 * the new times and pause or stop the alert without signing in.
 */
export default async function ManageAlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const fromNotification = (await searchParams).new === "1";
  const db = getDb();
  const alert = await alertByManageToken(db, token);
  const courseNames = new Map((await listSearchableCourses(db)).map((c) => [c.slug, c.name]));
  const latest =
    alert && alert.status !== "deleted" ? await latestTimes(db, alert, new Date()) : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {fromNotification && latest.length > 0 ? "New tee times" : "Your alert"}
        </h1>
        {latest.length > 0 && <LatestTimes times={latest} />}
        {!alert || alert.status === "deleted" ? (
          <p className="mt-4">
            This alert has been deleted. You won&apos;t hear about it again.{" "}
            <Link href="/" className="text-brand underline">
              Search for a tee time
            </Link>
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border p-4">
            <AlertSummary alert={alert} courseNames={courseNames} />
            {alert.status === "ended" ? (
              <p className="text-sm text-muted">
                This alert has ended because its dates have passed.
              </p>
            ) : (
              <div className="flex gap-2">
                <form action={changeAlertByToken}>
                  <input type="hidden" name="token" value={token} />
                  <input
                    type="hidden"
                    name="status"
                    value={alert.status === "paused" ? "active" : "paused"}
                  />
                  <button type="submit" className={secondaryButton}>
                    {alert.status === "paused" ? "Turn back on" : "Pause alert"}
                  </button>
                </form>
                <form action={changeAlertByToken}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="status" value="deleted" />
                  <button type="submit" className={secondaryButton}>
                    Stop and delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

interface LatestTime {
  key: string;
  courseName: string;
  startTime: Date;
  holes: number;
  /** Where Book goes, or null when the time has gone. */
  href: string | null;
}

/** The times in the last notification, checked against what's free now. */
async function latestTimes(db: Database, alert: Alert, now: Date): Promise<LatestTime[]> {
  const sent = await latestAlertRound(db, alert);
  if (sent.length === 0) return [];
  const filters = alertFilters(alert);
  const today = perthDate(now);
  const current =
    filters.dateTo < today
      ? null
      : await searchTeeTimes(
          db,
          { ...filters, dateFrom: filters.dateFrom < today ? today : filters.dateFrom },
          now,
        );
  const free = new Map(
    (current?.courses ?? []).flatMap((c) =>
      c.teeTimes.map((t) => [`${c.course.id}|${t.startTime.toISOString()}|${t.holes}`, t]),
    ),
  );
  return sent.map((s) => {
    const key = `${s.courseId}|${s.startTime.toISOString()}|${s.holes}`;
    const stillFree = free.get(key);
    return {
      key,
      courseName: s.courseName,
      startTime: s.startTime,
      holes: s.holes,
      href: stillFree ? (s.clickToken ? `/go/${s.clickToken}` : stillFree.bookingUrl) : null,
    };
  });
}

function LatestTimes({ times }: { times: LatestTime[] }) {
  const free = times.filter((t) => t.href).length;
  return (
    <section aria-label="Latest times" className="mt-4">
      <p className="text-sm text-muted">
        {free === 0
          ? "These have been booked since we told you. We'll let you know when more open up."
          : "Book quickly: times go fast. You book and pay with the club."}
      </p>
      <ul className="mt-3 rounded-xl border border-border">
        {times.map((t) => (
          <li
            key={t.key}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {formatPerthDay(perthDate(t.startTime))} {formatPerthTime(t.startTime)}
              </span>
              <span className="block text-sm text-muted">
                {t.courseName} · {t.holes} holes
              </span>
            </span>
            {t.href ? (
              <a href={t.href} target="_blank" rel="noopener" className={primaryButton}>
                Book
              </a>
            ) : (
              <span className="text-sm text-muted">Gone</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
