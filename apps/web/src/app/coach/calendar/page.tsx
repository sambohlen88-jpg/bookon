import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  WEEKDAYS,
  addPerthDays,
  calendarSubscribeLinks,
  formatAuPhone,
  formatAgo,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  isoWeekday,
  perthDate,
  perthToUtc,
  type CoachProfile,
} from "@bookon/core";
import {
  coachCalendar,
  coachCalendarToken,
  coachForEmail,
  groupSessionsForCoach,
  type CoachBusy,
  type CoachSession,
  type LessonBooking,
} from "@bookon/db";
import {
  blockOutTime,
  checkBusyCalendarNow,
  newCalendarLink,
  removeBusyCalendar,
  saveBusyCalendar,
  unblockTime,
} from "@/app/coach/calendar-actions";
import { acceptLessonFromPortal, declineLessonFromPortal } from "@/app/coach/lesson-actions";
import { Checkbox } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { clockLabel } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My calendar · BookOn", robots: { index: false } };

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE: Record<string, string> = {
  blocked: "Blocked out. Golfers can't book that time.",
  unblocked: "Removed. That time can be booked again if it's in your usual hours.",
  accepted: "Accepted. The golfer's card is charged and we've emailed them to confirm.",
  declined: "Declined. The hold on the golfer's card is released and we've told them.",
  newlink:
    "Here's your new link. The old one has stopped working, so add this one to your calendar app.",
  calendar: "Saved and read. Busy times in your calendar now can't be booked on BookOn.",
  checked: "Read again just now.",
  removed: "Removed. BookOn no longer reads your calendar.",
};

interface DayInfo {
  date: string;
  lessons: LessonBooking[];
  /** Group sessions going ahead (Milestone 19). */
  sessions: CoachSession[];
  busy: CoachBusy[];
  away: boolean;
  teaching: { from: string; to: string }[];
}

function monthOf(value: string | undefined, today: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function monthName(month: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    month: "long",
    year: "numeric",
  }).format(perthToUtc(`${month}-15`, "12:00"));
}

function daysOf(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const range = (start: Date, end: Date) => `${formatPerthTime(start)} to ${formatPerthTime(end)}`;

/** A coach's own calendar (Milestone 16): the month at a glance, and each day's schedule. */
export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach/calendar");
  const db = getDb();
  const coach = await coachForEmail(db, user!.email);
  if (!coach) redirect("/coach");
  const query = await searchParams;
  const now = new Date();
  const today = perthDate(now);
  const selected = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : null;
  const month = selected ? selected.slice(0, 7) : monthOf(query.month, today);
  const first = `${month}-01`;
  const last = `${month}-${String(daysOf(month)).padStart(2, "0")}`;
  const gridStart = addPerthDays(first, -(isoWeekday(first) - 1));
  const gridEnd = addPerthDays(last, 7 - isoWeekday(last));
  const day = selected ?? (today.startsWith(month) ? today : first);
  const profile: CoachProfile | null = coach!.profile ?? coach!.draft;

  const calendar = await coachCalendar(
    db,
    coach!.id,
    perthToUtc(gridStart, "00:00"),
    new Date(perthToUtc(gridEnd, "00:00").getTime() + DAY_MS),
  );
  const sessions = (
    await groupSessionsForCoach(db, coach!.id, now, {
      from: perthToUtc(gridStart, "00:00"),
      to: new Date(perthToUtc(gridEnd, "00:00").getTime() + DAY_MS),
    })
  ).filter((s) => s.status === "open");
  const info = (date: string): DayInfo => {
    const start = perthToUtc(date, "00:00");
    const end = new Date(start.getTime() + DAY_MS);
    return {
      date,
      lessons: calendar.lessons.filter((l) => perthDate(l.startTime) === date),
      sessions: sessions.filter((g) => perthDate(g.startTime) === date),
      busy: calendar.busy.filter((b) => b.startTime < end && b.endTime > start),
      away: profile?.away.some((a) => a.from <= date && date <= a.to) ?? false,
      teaching: profile?.hours.filter((h) => h.day === isoWeekday(date)) ?? [],
    };
  };
  const grid: DayInfo[] = [];
  for (let d = gridStart; d <= gridEnd; d = addPerthDays(d, 1)) grid.push(info(d));
  const chosen = info(day);

  const token = await coachCalendarToken(db, coach!, now);
  const feedUrl = `${await siteOrigin()}/calendar/${token}.ics`;
  const subscribe = calendarSubscribeLinks(feedUrl, "BookOn lessons");
  const busyAhead = coach!.busyCalendarUrl
    ? (await coachCalendar(db, coach!.id, now, new Date(now.getTime() + 35 * DAY_MS))).busy.filter(
        (b) => b.source === "calendar",
      ).length
    : 0;
  const dayLink = (d: string) => `/coach/calendar?day=${d}#day`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href="/coach" className="text-sm font-medium text-brand">
          ← My coaching
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">My calendar</h1>
        <p className="mt-1 text-muted">
          Lessons and group sessions booked through BookOn, requests waiting for you, and times
          you&apos;ve blocked out.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        </div>

        <section aria-labelledby="month" className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="month" className="text-xl font-semibold">
              {monthName(month)}
            </h2>
            <nav aria-label="Months" className="flex gap-2">
              <Link
                href={`/coach/calendar?month=${shiftMonth(month, -1)}`}
                className={secondaryButton}
                aria-label="Previous month"
              >
                ‹
              </Link>
              <Link href="/coach/calendar" className={secondaryButton}>
                Today
              </Link>
              <Link
                href={`/coach/calendar?month=${shiftMonth(month, 1)}`}
                className={secondaryButton}
                aria-label="Next month"
              >
                ›
              </Link>
            </nav>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted md:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <ol className="mt-1 grid grid-cols-7 gap-1 md:gap-2">
            {grid.map((d) => {
              const inMonth = d.date.startsWith(month);
              const booked = d.lessons.filter((l) => l.status === "confirmed").length;
              const waiting = d.lessons.filter((l) => l.status === "requested").length;
              const busy = d.busy.length > 0;
              const groups = d.sessions.length;
              const isDay = d.date === day;
              return (
                <li key={d.date}>
                  <Link
                    href={dayLink(d.date)}
                    aria-current={isDay ? "date" : undefined}
                    aria-label={`${formatPerthDay(d.date)}: ${booked} booked, ${waiting} waiting${groups ? `, ${groups} group ${groups === 1 ? "session" : "sessions"}` : ""}${busy ? ", busy times" : ""}${d.away ? ", away" : ""}`}
                    className={`flex min-h-14 flex-col rounded-lg border p-1 text-left md:min-h-24 md:p-2 ${
                      isDay ? "border-brand ring-2 ring-brand" : "border-border"
                    } ${inMonth ? "" : "opacity-50"} ${
                      d.teaching.length && !d.away ? "bg-surface" : ""
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${d.date === today ? "text-brand" : ""}`}
                    >
                      {Number(d.date.slice(8))}
                    </span>
                    <span className="mt-auto flex flex-wrap gap-1 md:hidden" aria-hidden>
                      {booked > 0 && <span className="size-2 rounded-full bg-brand" />}
                      {groups > 0 && <span className="size-2 rounded-full border-2 border-brand" />}
                      {waiting > 0 && (
                        <span className="size-2 rounded-full border border-warning-border bg-warning-bg" />
                      )}
                      {(busy || d.away) && <span className="size-2 rounded-full bg-muted" />}
                    </span>
                    <span className="mt-1 hidden flex-col gap-0.5 text-xs md:flex" aria-hidden>
                      {booked > 0 && (
                        <span className="rounded bg-brand px-1 text-brand-foreground">
                          {booked} {booked === 1 ? "lesson" : "lessons"}
                        </span>
                      )}
                      {groups > 0 && (
                        <span className="rounded border border-brand px-1 text-brand">
                          {groups} group
                        </span>
                      )}
                      {waiting > 0 && (
                        <span className="rounded border border-warning-border bg-warning-bg px-1 text-warning-fg">
                          {waiting} waiting
                        </span>
                      )}
                      {d.away && <span className="text-muted">Away</span>}
                      {busy && !d.away && <span className="text-muted">Busy times</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-brand" /> Booked
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full border-2 border-brand" /> Group session
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full border border-warning-border bg-warning-bg" />{" "}
              Waiting for you
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-muted" /> Busy or away
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded border border-border bg-surface" /> Usual teaching day
            </span>
          </p>
        </section>

        <section id="day" aria-labelledby="day-heading" className="mt-8 scroll-mt-4">
          <h2 id="day-heading" className="text-xl font-semibold">
            {formatPerthDay(day)}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {chosen.away
              ? "You're away (from your listing)."
              : chosen.teaching.length
                ? `Usual hours: ${chosen.teaching.map((h) => `${clockLabel(h.from)} to ${clockLabel(h.to)}`).join(", ")}.`
                : "Not one of your usual teaching days."}
          </p>
          <DaySchedule info={chosen} now={now} token={token} />

          {day >= today && (
            <form
              action={blockOutTime}
              className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4"
            >
              <h3 className="font-semibold">Block out time on {formatPerthDay(day)}</h3>
              <p className="text-sm text-muted">
                For anything golfers shouldn&apos;t book over, like a lesson booked elsewhere. Only
                you see the note.
              </p>
              <input type="hidden" name="day" value={day} />
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium">
                  From
                  <input
                    type="time"
                    name="from"
                    step={900}
                    defaultValue="09:00"
                    className={`${textInput} mt-1 w-32`}
                  />
                </label>
                <label className="text-sm font-medium">
                  To
                  <input
                    type="time"
                    name="to"
                    step={900}
                    defaultValue="10:00"
                    className={`${textInput} mt-1 w-32`}
                  />
                </label>
                <label className="min-w-48 flex-1 text-sm font-medium">
                  Note (optional)
                  <input name="note" maxLength={120} className={`${textInput} mt-1`} />
                </label>
              </div>
              <Checkbox name="wholeDay" value="yes">
                The whole day
              </Checkbox>
              <button type="submit" className={`${primaryButton} self-start`}>
                Block out
              </button>
            </form>
          )}
        </section>

        <section
          id="sync"
          aria-labelledby="sync-heading"
          className="mt-10 scroll-mt-4 rounded-xl border border-border p-4 md:p-6"
        >
          <h2 id="sync-heading" className="text-lg font-semibold">
            See your BookOn lessons in your calendar app
          </h2>
          <p className="mt-1 text-sm text-muted">
            Add this private link once and booked lessons appear in your calendar by themselves.
            Requests waiting for you show as &quot;not confirmed&quot;.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={subscribe.apple} className={primaryButton}>
              Apple Calendar
            </a>
            <a href={subscribe.google} target="_blank" rel="noopener" className={secondaryButton}>
              Google Calendar
            </a>
            <a href={subscribe.outlook} target="_blank" rel="noopener" className={secondaryButton}>
              Outlook
            </a>
          </div>
          <label htmlFor="feed" className="mt-4 block text-sm font-medium">
            Or copy the link into another calendar app
          </label>
          <input id="feed" readOnly value={feedUrl} className={`${textInput} mt-1 text-sm`} />
          <p className="mt-2 text-sm text-muted">
            Apple Calendar checks for changes about every 15 minutes to an hour (you can choose).
            Google Calendar can take several hours, so for a lesson booked today, use &quot;Add to
            calendar&quot; on the lesson. Keep the link to yourself: anyone with it can see your
            lessons.
          </p>
          <form action={newCalendarLink} className="mt-3">
            <button type="submit" className={secondaryButton}>
              Make a new link (the old one stops working)
            </button>
          </form>
        </section>

        <section
          id="busy"
          aria-labelledby="busy-heading"
          className="mt-6 scroll-mt-4 rounded-xl border border-border p-4 md:p-6"
        >
          <h2 id="busy-heading" className="text-lg font-semibold">
            Block times from your own calendar
          </h2>
          <p className="mt-1 text-sm text-muted">
            Paste your calendar&apos;s private link and BookOn checks it every half hour. Times
            you&apos;re busy can&apos;t be booked. BookOn only keeps when you&apos;re busy, never
            what the event is. Events marked &quot;free&quot; don&apos;t count.
          </p>
          {coach!.busyCalendarUrl && (
            <div className="mt-3">
              {coach!.busyCalendarError ? (
                <Notice tone="warning">{coach!.busyCalendarError}</Notice>
              ) : coach!.busyCalendarReadAt ? (
                <Notice tone="info">
                  Read {formatAgo(coach!.busyCalendarReadAt, now)}: {busyAhead} busy{" "}
                  {busyAhead === 1 ? "time" : "times"} in the next five weeks.
                </Notice>
              ) : (
                <Notice tone="info">Saved. BookOn reads it within half an hour.</Notice>
              )}
            </div>
          )}
          <form action={saveBusyCalendar} className="mt-3 flex flex-col gap-3">
            <label htmlFor="busy-url" className="text-sm font-medium">
              Your calendar&apos;s private link
            </label>
            <input
              id="busy-url"
              name="url"
              type="url"
              required
              defaultValue={coach!.busyCalendarUrl ?? ""}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              className={textInput}
            />
            <button type="submit" className={`${primaryButton} self-start`}>
              {coach!.busyCalendarUrl ? "Save and read again" : "Save"}
            </button>
          </form>
          {coach!.busyCalendarUrl && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={checkBusyCalendarNow}>
                <button type="submit" className={secondaryButton}>
                  Check now
                </button>
              </form>
              <form action={removeBusyCalendar}>
                <button type="submit" className={secondaryButton}>
                  Stop reading my calendar
                </button>
              </form>
            </div>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-brand">
              Where do I find my calendar&apos;s link?
            </summary>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong>Google Calendar</strong> (on a computer): Settings, then your calendar under
                &quot;Settings for my calendars&quot;, then &quot;Integrate calendar&quot;. Copy the{" "}
                <strong>Secret address in iCal format</strong>.
              </li>
              <li>
                <strong>Outlook</strong>: Settings, Calendar, Shared calendars, then &quot;Publish a
                calendar&quot;. Choose &quot;Can view when I&apos;m busy&quot; and copy the{" "}
                <strong>ICS</strong> link.
              </li>
              <li>
                <strong>Apple (iCloud)</strong>: in the Calendar app, share the calendar, turn on
                &quot;Public Calendar&quot; and copy the link. Anyone with an iCloud public link can
                see the events, so keep it private.
              </li>
            </ul>
          </details>
        </section>
      </main>
    </>
  );
}

function DaySchedule({ info, now, token }: { info: DayInfo; now: Date; token: string }) {
  const items = [
    ...info.lessons.map((l) => ({ at: l.startTime, kind: "lesson" as const, lesson: l })),
    ...info.sessions.map((g) => ({ at: g.startTime, kind: "group" as const, session: g })),
    ...info.busy.map((b) => ({ at: b.startTime, kind: "busy" as const, busy: b })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (items.length === 0)
    return <p className="mt-3 rounded-xl border border-border p-4 text-muted">Nothing on.</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {items.map((item) => {
        if (item.kind === "busy") {
          const b = item.busy;
          const allDay = b.endTime.getTime() - b.startTime.getTime() >= DAY_MS;
          return (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <span>
                <span className="font-medium">
                  {allDay ? "All day" : range(b.startTime, b.endTime)}
                </span>{" "}
                ·{" "}
                {b.source === "block"
                  ? `Blocked out${b.note ? `: ${b.note}` : ""}`
                  : "Busy in your calendar"}
              </span>
              {b.source === "block" && b.endTime > now && (
                <form action={unblockTime}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="day" value={info.date} />
                  <button type="submit" className={secondaryButton}>
                    Remove
                  </button>
                </form>
              )}
            </li>
          );
        }
        if (item.kind === "group") {
          const g = item.session;
          const paid = g.bookings.reduce((n, b) => n + b.spots, 0);
          return (
            <li key={g.id} className="rounded-xl border-2 border-brand p-3">
              <p className="font-semibold">
                {range(g.startTime, g.endTime)} · {g.title}
                <span className="ml-2 text-sm font-normal text-muted">
                  {paid} of {g.spots} booked
                </span>
              </p>
              <p className="text-sm text-muted">
                Group session · {g.place} · {formatPrice(g.priceCents)} a spot
                {g.minSpots && !g.goingAheadAt ? ` · needs ${g.minSpots}` : ""}
              </p>
              {g.bookings.length > 0 ? (
                <ul className="mt-1 text-sm">
                  {g.bookings.map((b) => (
                    <li key={b.id}>
                      {b.golferName}
                      {b.spots > 1 && ` (${b.spots} spots)`} ·{" "}
                      <a href={`tel:${b.golferPhone}`} className="text-brand">
                        {formatAuPhone(b.golferPhone)}
                      </a>
                      {b.note && <span className="text-muted"> · &ldquo;{b.note}&rdquo;</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">Nobody booked yet.</p>
              )}
              <Link
                href="/coach#sessions"
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand"
              >
                Manage in My coaching
              </Link>
            </li>
          );
        }
        const l = item.lesson;
        const waiting = l.status === "requested";
        const open = waiting && (!l.respondBy || l.respondBy > now);
        return (
          <li
            key={l.id}
            className={`rounded-xl border p-3 ${waiting ? "border-warning-border bg-warning-bg/40" : "border-brand"}`}
          >
            <p className="font-semibold">
              {range(l.startTime, l.endTime)} · {l.golferName}
              <span className="ml-2 text-sm font-normal text-muted">
                {waiting ? "Waiting for you" : "Booked"}
              </span>
            </p>
            <p className="text-sm text-muted">
              {l.rate.name}, {l.rate.minutes} min · {l.place} · you&apos;re paid{" "}
              {formatPrice(l.lessonCents)}
            </p>
            <p className="mt-1 text-sm">
              <a href={`tel:${l.golferPhone}`} className="text-brand">
                {formatAuPhone(l.golferPhone)}
              </a>{" "}
              ·{" "}
              <a href={`mailto:${l.golferEmail}`} className="text-brand">
                {l.golferEmail}
              </a>
            </p>
            {l.note && <p className="mt-1 text-sm">&ldquo;{l.note}&rdquo;</p>}
            {open ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form action={acceptLessonFromPortal}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="calendarDay" value={info.date} />
                  <button type="submit" className={primaryButton}>
                    Accept and charge {formatPrice(l.lessonCents + l.feeCents)}
                  </button>
                </form>
                <form action={declineLessonFromPortal}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="calendarDay" value={info.date} />
                  <button type="submit" className={secondaryButton}>
                    Decline
                  </button>
                </form>
                <span className="text-sm text-muted">
                  Answer by {formatPerthDay(perthDate(l.respondBy!))},{" "}
                  {formatPerthTime(l.respondBy!)}
                </span>
              </div>
            ) : (
              !waiting && (
                <a
                  href={`/calendar/${token}/${l.id}.ics`}
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand"
                >
                  Add to my calendar
                </a>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
