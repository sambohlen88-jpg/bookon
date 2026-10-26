import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatAgo, formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import {
  coachById,
  entriesForGolfer,
  groupBookingsForGolfer,
  isSubscribed,
  lessonsForGolfer,
  listAlerts,
  listFavourites,
  listPushSubscriptions,
  listSearchableCourses,
  listVisits,
  type Alert,
  type Coach,
} from "@bookon/db";
import {
  changeAlert,
  changeAlertChannel,
  clearMyVisits,
  deleteMyAccount,
  joinNewsletter,
  leaveNewsletter,
  signOut,
  toggleFavourite,
} from "@/app/actions";
import { AlertSummary } from "@/components/alert-summary";
import { PushToggle } from "@/components/push-toggle";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account · BookOn" };

const TABS = [
  { id: "courses", label: "My courses" },
  { id: "alerts", label: "Alerts" },
  { id: "lessons", label: "Lessons" },
  { id: "visits", label: "Looked at" },
  { id: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const LESSON_STATUS = {
  checkout: "not paid",
  requested: "waiting for the coach",
  confirmed: "booked",
  declined: "declined",
  lapsed: "lapsed",
  cancelled: "cancelled",
  abandoned: "not paid",
} as const;

const section = "mt-6";
const heading = "text-lg font-semibold";
const card = "mt-3 rounded-xl border border-border";
const row =
  "flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { error, tab: asked, newsletter } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === asked) ? (asked as Tab) : "courses";
  const user = await currentUser();
  if (!user)
    redirect(
      `/signin?next=${encodeURIComponent(tab === "courses" ? "/account" : `/account?tab=${tab}`)}`,
    );
  const db = getDb();
  const now = new Date();
  const [favourites, alerts, visits, courses, devices, publicKey, lessons] = [
    await listFavourites(db, user.id),
    await listAlerts(db, user.id),
    await listVisits(db, user.id),
    await listSearchableCourses(db),
    await listPushSubscriptions(db, user.id),
    await pushPublicKey(),
    tab === "lessons" ? await lessonsForGolfer(db, user.email, user.id) : [],
  ];
  const groups = tab === "lessons" ? await groupBookingsForGolfer(db, user.email, user.id) : [];
  // Club event entries (Milestone 21).
  const entries = tab === "lessons" ? await entriesForGolfer(db, user.email, user.id) : [];
  const lessonCoaches = new Map<string, Coach | null>();
  for (const id of [...lessons.map((l) => l.coachId), ...groups.map((g) => g.session.coachId)])
    if (!lessonCoaches.has(id)) lessonCoaches.set(id, await coachById(db, id));
  const courseNames = new Map(courses.map((c) => [c.slug, c.name]));
  // The newsletter (Milestone 27), shown under Settings.
  const subscribed = tab === "settings" ? await isSubscribed(db, user.email) : false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:max-w-2xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight">My account</h1>
        <p className="mt-1 text-muted">{user.email}</p>
        <nav
          aria-label="My account"
          className="relative -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        >
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "courses" ? "/account" : `/account?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap ${tab === t.id ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
            >
              {t.label}
              {t.id === "alerts" && alerts.some((a) => a.status === "active") && (
                <span className="ml-1.5">
                  · {alerts.filter((a) => a.status === "active").length}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {tab === "courses" && (
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
        )}

        {tab === "alerts" && (
          <>
            <section className={section} aria-labelledby="alerts">
              <h2 id="alerts" className={heading}>
                Alerts
              </h2>
              {alerts.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Search for a time, then tap <strong>Tell me when a time opens up</strong>.
                  We&apos;ll email you when one appears.
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
                        <AlertChannels alert={a} canPush={devices.length > 0} />
                      )}
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

            <section className={section} aria-labelledby="notifications">
              <h2 id="notifications" className={heading}>
                Notifications
              </h2>
              <div className={`${card} flex flex-col gap-2 p-4`}>
                <PushToggle publicKey={publicKey} />
                {devices.length > 0 && (
                  <p className="text-sm text-muted">
                    On for {devices.length === 1 ? "1 device" : `${devices.length} devices`}:{" "}
                    {devices.map((d) => d.deviceLabel ?? "a device").join(", ")}.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {tab === "lessons" && (
          <section className={section} aria-labelledby="lessons">
            <h2 id="lessons" className={heading}>
              Lessons
            </h2>
            {lessons.length === 0 && groups.length === 0 && entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Lessons, group sessions and competitions you book and pay for on BookOn show up
                here.{" "}
                <Link href="/coaches" className="text-brand">
                  Find a coach
                </Link>
              </p>
            ) : (
              <ul className={card}>
                {lessons.map((l) => (
                  <li key={l.id} className={row}>
                    <span>
                      <span className="block font-medium">
                        {lessonCoaches.get(l.coachId)?.profile?.name ?? "Coach"} · {l.rate.name}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatPerthDay(perthDate(l.startTime))} {formatPerthTime(l.startTime)} ·{" "}
                        {LESSON_STATUS[l.status]}
                      </span>
                    </span>
                    <Link href={`/lessons/${l.manageToken}`} className={secondaryButton}>
                      Open
                    </Link>
                  </li>
                ))}
                {groups.map(({ booking: b, session: s }) => (
                  <li key={b.id} className={row}>
                    <span>
                      <span className="block font-medium">
                        {lessonCoaches.get(s.coachId)?.profile?.name ?? "Coach"} · {s.title}
                        {b.spots > 1 ? ` (${b.spots} spots)` : ""}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatPerthDay(perthDate(s.startTime))} {formatPerthTime(s.startTime)} ·{" "}
                        {b.status === "cancelled" || s.status === "cancelled"
                          ? "Cancelled"
                          : "Booked"}
                      </span>
                    </span>
                    <Link href={`/sessions/${b.manageToken}`} className={secondaryButton}>
                      Open
                    </Link>
                  </li>
                ))}
                {entries.map(({ entry: e, event, clubName }) => (
                  <li key={e.id} className={row}>
                    <span>
                      <span className="block font-medium">
                        {clubName} · {event.title}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatPerthDay(event.date)} ·{" "}
                        {e.status === "paid" && event.status === "open"
                          ? "Entered"
                          : "Withdrawn or cancelled"}
                      </span>
                    </span>
                    <Link href={`/entries/${e.manageToken}`} className={secondaryButton}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "visits" && (
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
                          {v.source === "alert"
                            ? " · from an alert"
                            : v.source === "share"
                              ? " · from shared times"
                              : ""}
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
        )}

        {tab === "settings" && (
          <section className={section} aria-labelledby="newsletter">
            <h2 id="newsletter" className={heading}>
              BookOn news
            </h2>
            <p className="mt-2 text-sm text-muted">
              {subscribed
                ? "We email you BookOn news, golf tips and offers. Stop any time."
                : "Get BookOn news, golf tips and offers by email. Unsubscribe any time."}
            </p>
            {newsletter && (
              <div className="mt-3">
                <Notice tone="info">
                  {newsletter === "on"
                    ? "Done. You'll get the next BookOn news email."
                    : "Done. We won't send you BookOn news any more."}
                </Notice>
              </div>
            )}
            <form action={subscribed ? leaveNewsletter : joinNewsletter} className="mt-3">
              <button type="submit" className={secondaryButton}>
                {subscribed ? "Stop sending me BookOn news" : "Send me BookOn news"}
              </button>
            </form>
          </section>
        )}

        {tab === "settings" && (
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
                  <input
                    type="checkbox"
                    name="confirm"
                    value="yes"
                    className="size-5 accent-brand"
                  />
                  Yes, delete my account
                </label>
                <button type="submit" className={secondaryButton}>
                  Delete my account
                </button>
              </form>
            </details>
          </section>
        )}
      </main>
    </>
  );
}

/** "Tell me by: Email, Push". One stays on, so the golfer can always be reached. */
function AlertChannels({ alert, canPush }: { alert: Alert; canPush: boolean }) {
  const channels = [
    { key: "email", label: "Email", on: alert.notifyEmail },
    { key: "push", label: "Push", on: alert.notifyPush && canPush },
  ];
  const onCount = channels.filter((c) => c.on).length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Tell me by</span>
      {channels.map((c) =>
        c.key === "push" && !canPush ? (
          <span key={c.key} className="text-muted">
            · Push (turn on notifications above)
          </span>
        ) : (
          <form key={c.key} action={changeAlertChannel}>
            <input type="hidden" name="alertId" value={alert.id} />
            <input type="hidden" name="channel" value={c.key} />
            <input type="hidden" name="on" value={c.on ? "0" : "1"} />
            <button
              type="submit"
              aria-pressed={c.on}
              disabled={c.on && onCount === 1}
              title={c.on && onCount === 1 ? "One way to reach you stays on" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 font-medium disabled:cursor-not-allowed ${
                c.on
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border text-foreground"
              }`}
            >
              {c.on ? "✓ " : ""}
              {c.label}
            </button>
          </form>
        ),
      )}
    </div>
  );
}
