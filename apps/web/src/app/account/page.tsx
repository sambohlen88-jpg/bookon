import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatAgo, formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import { listAlerts, listFavourites, listSearchableCourses, listVisits } from "@bookon/db";
import {
  changeAlert,
  clearMyVisits,
  deleteMyAccount,
  signOut,
  toggleFavourite,
} from "@/app/actions";
import { AlertSummary } from "@/components/alert-summary";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account · BookOn" };

const section = "mt-8";
const heading = "text-lg font-semibold";
const card = "mt-3 rounded-xl border border-border";
const row =
  "flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/account");
  const { error } = await searchParams;
  const db = getDb();
  const now = new Date();
  const [favourites, alerts, visits, courses] = [
    await listFavourites(db, user.id),
    await listAlerts(db, user.id),
    await listVisits(db, user.id),
    await listSearchableCourses(db),
  ];
  const courseNames = new Map(courses.map((c) => [c.slug, c.name]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">My account</h1>
        <p className="mt-1 text-muted">{user.email}</p>

        <section className={section} aria-labelledby="favourites">
          <h2 id="favourites" className={heading}>
            Favourite courses
          </h2>
          {favourites.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Tap the star next to a course in your search results to save it here.
            </p>
          ) : (
            <>
              <ul className={card}>
                {favourites.map((c) => (
                  <li key={c.id} className={row}>
                    <span>
                      <span className="block">{c.name}</span>
                      <span className="block text-sm text-muted">{c.suburb}</span>
                    </span>
                    <form action={toggleFavourite}>
                      <input type="hidden" name="courseId" value={c.id} />
                      <input type="hidden" name="on" value="0" />
                      <input type="hidden" name="back" value="/account" />
                      <button
                        type="submit"
                        className={secondaryButton}
                        aria-label={`Remove ${c.name} from favourites`}
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <Link
                href={`/search?date=${perthDate(now)}&${favourites.map((c) => `course=${c.slug}`).join("&")}`}
                className={`${secondaryButton} mt-3`}
              >
                Search my courses
              </Link>
            </>
          )}
        </section>

        <section className={section} aria-labelledby="alerts">
          <h2 id="alerts" className={heading}>
            Alerts
          </h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Search for a time, then tap <strong>Tell me when a time opens up</strong>. We&apos;ll
              email you when one appears.
            </p>
          ) : (
            <ul className={card}>
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <AlertSummary alert={a} courseNames={courseNames} />
                  {a.status !== "ended" && (
                    <div className="flex gap-2">
                      <form action={changeAlert}>
                        <input type="hidden" name="alertId" value={a.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={a.status === "paused" ? "active" : "paused"}
                        />
                        <button type="submit" className={secondaryButton}>
                          {a.status === "paused" ? "Turn back on" : "Pause"}
                        </button>
                      </form>
                      <form action={changeAlert}>
                        <input type="hidden" name="alertId" value={a.id} />
                        <input type="hidden" name="status" value="deleted" />
                        <button type="submit" className={secondaryButton}>
                          Delete
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={section} aria-labelledby="visits">
          <h2 id="visits" className={heading}>
            Tee times you&apos;ve looked at
          </h2>
          {visits.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              When you tap Book on a tee time, it shows up here.
            </p>
          ) : (
            <>
              <ul className={card}>
                {visits.map((v, i) => (
                  <li key={i} className={row}>
                    <span>
                      <span className="block font-medium">{v.courseName}</span>
                      <span className="block text-sm text-muted">
                        {v.startTime
                          ? `${formatPerthDay(perthDate(v.startTime))} ${formatPerthTime(v.startTime)}`
                          : "Course page"}{" "}
                        · looked {formatAgo(v.clickedAt, now)}
                        {v.source === "alert" ? " · from an alert" : ""}
                      </span>
                    </span>
                    <Link
                      href={`/search?date=${perthDate(now)}&days=7&course=${v.courseSlug}`}
                      className={secondaryButton}
                      aria-label={`Search ${v.courseName} again`}
                    >
                      Search again
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                BookOn can&apos;t see whether you booked. Bookings are made with the club.
              </p>
              <form action={clearMyVisits} className="mt-3">
                <button type="submit" className={secondaryButton}>
                  Clear this list
                </button>
              </form>
            </>
          )}
        </section>

        <section className={section} aria-labelledby="settings">
          <h2 id="settings" className={heading}>
            Account
          </h2>
          <form action={signOut} className="mt-3">
            <button type="submit" className={secondaryButton}>
              Sign out
            </button>
          </form>
          <details className="mt-6 rounded-xl border border-border px-4">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">
              Delete my account
            </summary>
            <form action={deleteMyAccount} className="flex flex-col gap-3 pb-4">
              <p className="text-sm text-muted">
                This removes your email, favourites, alerts and the list of tee times you&apos;ve
                looked at. It can&apos;t be undone.
              </p>
              {error === "confirm" && <Notice tone="warning">Tick the box to confirm.</Notice>}
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="confirm" value="yes" className="size-5 accent-brand" />
                Yes, delete my account
              </label>
              <button type="submit" className={secondaryButton}>
                Delete my account
              </button>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
