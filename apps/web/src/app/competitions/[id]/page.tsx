import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TEAM_NAME,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  groupStartLabel,
  perthDate,
  type TeamSize,
} from "@bookon/core";
import {
  clubById,
  entriesForEvent,
  entryById,
  eventPaymentSettings,
  listedEvent,
} from "@bookon/db";
import { abandonEntryCheckout, clubTakesEntries } from "@bookon/payments";
import { enterEvent, joinEventWaitlist } from "@/app/competitions/[id]/actions";
import { Checkbox, Field, TextArea } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { PrivacyNote } from "@/components/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const event = await listedEvent(getDb(), (await params).id, new Date());
  if (!event) return { title: "Event not found · BookOn" };
  return {
    title: `${event.title}, ${event.clubName} · BookOn`,
    description: `${event.title} at ${event.courseName} on ${formatPerthDay(event.date)}. Enter and pay online.`,
    // Members-only events are shared by link, not found by search engines.
    ...(event.open ? {} : { robots: { index: false } }),
  };
}

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

/** A club event (Milestone 21): details, places left, entering and paying, then the start sheet and results. */
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { id } = await params;
  const query = await searchParams;
  const ctx = await lessonContext();
  const now = ctx?.now ?? new Date();

  // Back from the checkout page without paying: free the places now.
  if (ctx && query.cancelled) {
    const left = await entryById(db, query.cancelled);
    if (left && left.eventId === id) await abandonEntryCheckout(ctx, left);
  }

  const event = await listedEvent(db, id, now);
  if (!event) notFound();
  const club = (await clubById(db, event.clubId))!;
  const taking = ctx ? await clubTakesEntries(ctx, club) : false;
  const { feeCents } = await eventPaymentSettings(db);
  const cancelled = event.status === "cancelled";
  const played = event.firstStart <= now;
  const closed = event.entriesClose <= now;
  const full = event.left < event.teamSize;
  const canEnter = taking && !cancelled && !played && !closed && !full;
  const user = canEnter ? await currentUser() : null;
  const memberNumbers = event.memberFeeCents !== null || !event.open;
  const entries =
    event.startSheetPublishedAt || event.results ? await entriesForEvent(db, event.id) : [];
  const groups = event.startSheetPublishedAt
    ? [...new Set(entries.filter((e) => e.startGroup).map((e) => e.startGroup!))].sort(
        (a, b) => a - b,
      )
    : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href="/competitions" className="text-sm font-medium text-brand">
          ← Competitions
        </Link>
        <p className="mt-4 text-sm font-medium text-muted">
          {event.clubName}
          {event.open ? "" : " · members only"}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{event.title}</h1>
        <p className="mt-2 text-lg">
          {formatPerthDay(event.date)} ·{" "}
          {event.startType === "shotgun"
            ? `${formatPerthTime(event.firstStart)} shotgun`
            : `tee times from ${formatPerthTime(event.firstStart)}`}
        </p>
        <p className="text-muted">
          <Link href={`/courses/${event.courseSlug}`} className="text-brand">
            {event.courseName}
          </Link>
          , {event.suburb} · {TEAM_NAME[event.teamSize as TeamSize]}, {event.holes} holes
        </p>
        {event.description && <p className="mt-4 whitespace-pre-line">{event.description}</p>}

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border p-4">
          <dt className="text-muted">Entry fee</dt>
          <dd>
            <strong className="tabular-nums">{formatPrice(event.feeCents)}</strong> a player
            {event.memberFeeCents !== null && (
              <>
                {" "}
                ({formatPrice(event.memberFeeCents)} for members of {event.clubName})
              </>
            )}
          </dd>
          <dt className="text-muted">Places</dt>
          <dd className={full ? "font-semibold" : ""}>
            {full ? "Full" : `${event.left} of ${event.maxPlayers} left`}
          </dd>
          <dt className="text-muted">Entries close</dt>
          <dd>
            {when(event.entriesClose)}
            {closed && !played && " (closed)"}
          </dd>
        </dl>

        <div className="mt-4 flex flex-col gap-3">
          {query.cancelled && (
            <Notice tone="info">No problem, you haven&apos;t paid anything.</Notice>
          )}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {cancelled && (
            <Notice tone="warning">
              {event.clubName} has cancelled this event
              {event.cancelNote ? `: "${event.cancelNote}"` : "."} Everyone who entered has been
              refunded.
            </Notice>
          )}
        </div>

        {event.results && (
          <section aria-labelledby="results" className="mt-8">
            <h2 id="results" className="text-xl font-semibold">
              Results
            </h2>
            <p className="mt-3 whitespace-pre-line rounded-xl border border-border p-4">
              {event.results}
            </p>
          </section>
        )}

        {groups.length > 0 && !cancelled && (
          <section aria-labelledby="start-sheet" className="mt-8">
            <h2 id="start-sheet" className="text-xl font-semibold">
              Start sheet
            </h2>
            <ol className="mt-3 rounded-xl border border-border">
              {groups.map((g) => (
                <li key={g} className="border-t border-border px-4 py-3 first:border-t-0">
                  <span className="font-semibold">{groupStartLabel(event, g)}</span>
                  <span className="block text-sm text-muted">
                    {entries
                      .filter((e) => e.startGroup === g)
                      .flatMap((e) => e.players.map((p) => p.name))
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!cancelled && !played && (
          <section id="enter" aria-labelledby="enter-heading" className="mt-8 scroll-mt-4">
            <h2 id="enter-heading" className="text-xl font-semibold">
              Enter
            </h2>
            {!taking ? (
              <p className="mt-2 text-muted">
                {event.clubName} isn&apos;t taking entries through BookOn right now. Contact the
                club to enter.
              </p>
            ) : closed ? (
              <p className="mt-2 text-muted">
                Entries have closed. Contact the club if you&apos;d like a place.
              </p>
            ) : full ? (
              <div id="waitlist" className="mt-3 scroll-mt-4">
                {query.waiting ? (
                  <Notice tone="info">
                    You&apos;re on the waiting list. If a place frees up, we&apos;ll email you, and
                    the first to enter gets it.
                  </Notice>
                ) : (
                  <form
                    action={joinEventWaitlist}
                    className="flex flex-col gap-4 rounded-xl border border-border p-4"
                  >
                    <p>
                      It&apos;s full. Join the waiting list and we&apos;ll email you if a place
                      frees up.
                    </p>
                    <input type="hidden" name="eventId" value={event.id} />
                    <Field
                      label="Your name"
                      name="name"
                      required
                      maxLength={80}
                      autoComplete="name"
                    />
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                    <button type="submit" className={`${secondaryButton} self-start`}>
                      Join the waiting list
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form action={enterEvent} className="mt-3 flex flex-col gap-4">
                <input type="hidden" name="eventId" value={event.id} />
                {Array.from({ length: event.teamSize }, (_, i) => (
                  <fieldset
                    key={i}
                    className="flex flex-col gap-3 rounded-xl border border-border p-4"
                  >
                    <legend className="px-1 font-semibold">
                      {i === 0
                        ? event.teamSize === 1
                          ? "You"
                          : "You (player 1)"
                        : `Player ${i + 1}`}
                    </legend>
                    <Field
                      label={i === 0 ? "Your name" : "Name"}
                      name={`player${i}`}
                      required
                      maxLength={80}
                      autoComplete={i === 0 ? "name" : "off"}
                    />
                    {memberNumbers && (
                      <Field
                        label={`Member number at ${event.clubName}`}
                        name={`member${i}`}
                        maxLength={30}
                        required={!event.open}
                        hint={
                          event.open
                            ? `For the members' fee. The club checks it.`
                            : "This event is for members only."
                        }
                      />
                    )}
                  </fieldset>
                ))}
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={user?.email}
                  hint="For your confirmation, receipt and start time."
                />
                <Field
                  label="Mobile"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  autoComplete="tel"
                  hint="So the club can reach you about the day."
                />
                <TextArea
                  label="Anything the club should know"
                  name="note"
                  maxLength={500}
                  hint="For example who you'd like to play with, or dietary needs for a meal."
                />
                <section
                  aria-label="Summary"
                  className="rounded-xl border border-border bg-surface p-4 text-sm"
                >
                  <p className="font-semibold">
                    {event.teamSize === 1 ? "1 player" : `${event.teamSize} players`} at{" "}
                    {formatPrice(event.feeCents)}
                    {event.memberFeeCents !== null &&
                      ` (members ${formatPrice(event.memberFeeCents)})`}
                    , plus a {formatPrice(feeCents)} booking fee per entry
                  </p>
                  <p className="mt-1 text-muted">You&apos;ll see the exact total before you pay.</p>
                  <ul className="mt-3 list-disc pl-5 text-muted">
                    <li>Your card is charged when you enter.</li>
                    <li>
                      Withdraw before entries close ({when(event.entriesClose)}) for a full refund.
                      After that, refunds are up to the club.
                    </li>
                    <li>If the club cancels the event, you&apos;re refunded in full.</li>
                    <li>We&apos;ll email your start time once the club makes the start sheet.</li>
                  </ul>
                </section>
                <Checkbox name="agree" value="yes" required>
                  I agree to the refund rule above, and to BookOn sharing our names, my email and
                  mobile with {event.clubName} for this event.
                </Checkbox>
                <PrivacyNote />
                <button type="submit" className={primaryButton}>
                  Continue to payment
                </button>
                <p className="text-center text-sm text-muted">
                  {ctx?.payments.kind === "practice"
                    ? "Practice payments: no money moves on this computer."
                    : "Payment is on Stripe's secure page. BookOn never sees your card."}
                </p>
              </form>
            )}
          </section>
        )}
        {played && !event.results && !cancelled && (
          <p className="mt-8 text-muted">
            This event has been played. Results will show here if the club adds them.
          </p>
        )}
        <p className="mt-10 text-xs text-muted">
          {event.clubName} runs this event. Questions about the day go to the club.
        </p>
      </main>
    </>
  );
}
