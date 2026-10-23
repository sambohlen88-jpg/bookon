import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GROUP_SIZE,
  TEAM_NAME,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  groupStartLabel,
  maxGroups,
  perthDate,
  type TeamSize,
} from "@bookon/core";
import {
  endedEntriesForEvent,
  entriesForEvent,
  entryTotalCents,
  listedEvent,
  waitlistFor,
  type EventEntry,
} from "@bookon/db";
import {
  cancelClubEvent,
  makeStartSheetInOrder,
  makeStartSheetShuffled,
  moveEntry,
  publishClubStartSheet,
  saveEventResults,
  withdrawEntryNoRefund,
  withdrawEntryWithRefund,
} from "@/app/club/[clubId]/events/actions";
import { PageTitle, Pill, panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

const DONE: Record<string, string> = {
  created: "Your event is on. Share the link below, and golfers can enter and pay.",
  saved: "Saved.",
  cancelled: "Cancelled. Everyone who entered is being refunded in full, and we've emailed them.",
  refunded: "Withdrawn and refunded in full. We've emailed them.",
  withdrawn: "Withdrawn, without a refund. We've emailed them.",
  sheet: "Start sheet made. Check it, move anyone you need to, then publish it.",
  moved: "Moved.",
  published: "Published. Everyone has been emailed their start.",
  results: "Results saved.",
};

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

function Players({ entry }: { entry: EventEntry }) {
  return (
    <>
      {entry.players.map((p, i) => (
        <span key={i} className="block">
          {p.name}
          {p.memberNumber && <span className="text-muted"> · member {p.memberNumber}</span>}
        </span>
      ))}
    </>
  );
}

/** One event in the club portal (Milestone 21): entries, start sheet, results. */
export default async function ClubEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string; eventId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId, eventId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/events/${eventId}`);
  const db = getDb();
  const now = new Date();
  const event = await listedEvent(db, eventId, now);
  if (!event || event.clubId !== club.id) notFound();
  const query = await searchParams;
  const entries = await entriesForEvent(db, event.id);
  const ended = await endedEntriesForEvent(db, event.id);
  const waiting = await waitlistFor(db, event.id);
  const publicLink = `${await siteOrigin()}/competitions/${event.id}`;
  const base = `/club/${club.id}/events/${event.id}`;
  const open = event.status === "open";
  const played = event.firstStart <= now;
  const hidden = (
    <>
      <input type="hidden" name="clubId" value={club.id} />
      <input type="hidden" name="eventId" value={event.id} />
    </>
  );

  // The start sheet: groups in order, and anyone not placed yet.
  const placed = entries.filter((e) => e.startGroup !== null);
  const unplaced = entries.filter((e) => e.startGroup === null);
  const groupCount = Math.max(0, ...placed.map((e) => e.startGroup!));
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    group: i + 1,
    entries: placed.filter((e) => e.startGroup === i + 1),
  }));
  // Room to move a team into a new group at the end.
  const moveChoices = Math.min(maxGroups(event), groupCount + 1);

  return (
    <>
      <Link href={`/club/${club.id}/events`} className="text-sm font-medium text-brand">
        ← Events
      </Link>
      <PageTitle title={event.title} />
      <div className="mb-4 flex flex-col gap-2">
        {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
        {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        {!open && (
          <Notice tone="warning">
            This event is cancelled{event.cancelNote ? `: "${event.cancelNote}"` : "."}
          </Notice>
        )}
      </div>

      <section className={`${panel} mb-6`}>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Day</dt>
          <dd>
            {formatPerthDay(event.date)},{" "}
            {event.startType === "shotgun"
              ? `${formatPerthTime(event.firstStart)} shotgun`
              : `tee times from ${formatPerthTime(event.firstStart)}, every ${event.intervalMinutes} minutes${event.twoTees ? ", 1st and 10th tees" : ""}`}
          </dd>
          <dt className="text-muted">Format</dt>
          <dd>
            {TEAM_NAME[event.teamSize as TeamSize]}, {event.holes} holes, {event.courseName}
          </dd>
          <dt className="text-muted">Fee</dt>
          <dd>
            {formatPrice(event.feeCents)} a player
            {event.memberFeeCents !== null && `, members ${formatPrice(event.memberFeeCents)}`}
          </dd>
          <dt className="text-muted">Entered</dt>
          <dd>
            <strong>
              {event.taken} of {event.maxPlayers}
            </strong>{" "}
            players ({entries.length} {entries.length === 1 ? "entry" : "entries"})
          </dd>
          <dt className="text-muted">Entries close</dt>
          <dd>
            {when(event.entriesClose)}
            {event.entriesClose <= now && " (closed)"}
          </dd>
          <dt className="text-muted">Who can enter</dt>
          <dd>{event.open ? "Anyone (listed on BookOn)" : "Members only (not listed)"}</dd>
        </dl>
        <p className="mt-3 text-sm">
          Link for golfers:{" "}
          <a href={publicLink} className="break-all text-brand underline">
            {publicLink}
          </a>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {open && !played && (
            <Link href={`${base}/edit`} className={secondaryButton}>
              Change details
            </Link>
          )}
          <a href={`${base}/entries.csv`} className={secondaryButton}>
            Download entries (CSV)
          </a>
        </div>
      </section>

      <section id="entries" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-lg font-semibold">Entries</h2>
        {entries.length === 0 ? (
          <p className="text-muted">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Players</th>
                  <th className={thClass}>Contact</th>
                  <th className={`${thClass} text-right`}>Fees</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id}>
                    <td className={`${tdClass} tabular-nums`}>{i + 1}</td>
                    <td className={tdClass}>
                      <Players entry={e} />
                      {e.note && <span className="block text-muted">&ldquo;{e.note}&rdquo;</span>}
                    </td>
                    <td className={tdClass}>
                      {e.contactName}
                      <a href={`tel:${e.contactPhone}`} className="block text-brand">
                        {formatAuPhone(e.contactPhone)}
                      </a>
                      <a href={`mailto:${e.contactEmail}`} className="block break-all text-brand">
                        {e.contactEmail}
                      </a>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatPrice(e.feesCents)}
                    </td>
                    <td className={tdClass}>
                      {open && !played && (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-brand">
                            Withdraw
                          </summary>
                          <div className="mt-2 flex flex-col gap-2">
                            <form action={withdrawEntryWithRefund} className="flex flex-col gap-2">
                              {hidden}
                              <input type="hidden" name="entryId" value={e.id} />
                              <label className="sr-only" htmlFor={`note-${e.id}`}>
                                Note to the golfer
                              </label>
                              <input
                                id={`note-${e.id}`}
                                name="note"
                                maxLength={300}
                                placeholder="Note to the golfer (optional)"
                                className={`${textInput} min-h-11`}
                              />
                              <button type="submit" className={secondaryButton}>
                                Withdraw and refund {formatPrice(entryTotalCents(e))}
                              </button>
                            </form>
                            <form action={withdrawEntryNoRefund}>
                              {hidden}
                              <input type="hidden" name="entryId" value={e.id} />
                              <button type="submit" className={secondaryButton}>
                                Withdraw, no refund
                              </button>
                            </form>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ended.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Withdrawn and cancelled ({ended.length})
            </summary>
            <ul className="mt-2">
              {ended.map((e) => (
                <li key={e.id} className="border-t border-border py-2 first:border-t-0">
                  {e.contactName} ({e.players.map((p) => p.name).join(", ")}) ·{" "}
                  {e.cancelledBy === "golfer"
                    ? "withdrew"
                    : e.cancelledBy === "club"
                      ? "withdrawn by the club"
                      : "event cancelled"}
                  {e.refundCents > 0
                    ? `, refunded ${formatPrice(e.refundCents)}`
                    : ", not refunded"}
                </li>
              ))}
            </ul>
          </details>
        )}
        {waiting.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Waiting list ({waiting.length})
            </summary>
            <ul className="mt-2">
              {waiting.map((w) => (
                <li key={w.id} className="border-t border-border py-2 first:border-t-0">
                  {w.name} · {w.email} · {w.players} {w.players === 1 ? "player" : "players"}
                  {w.notifiedAt ? " · told a place came up" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted">
              When a place frees up before entries close, everyone who fits is emailed and the first
              to pay gets it.
            </p>
          </details>
        )}
      </section>

      <section id="start-sheet" className="mb-8 scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Start sheet</h2>
          {event.startSheetPublishedAt ? (
            <Pill tone="good">Published {when(event.startSheetPublishedAt)}</Pill>
          ) : (
            groupCount > 0 && <Pill tone="warn">Not published yet</Pill>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="text-muted">Once golfers enter, you can make the start sheet here.</p>
        ) : (
          <>
            {open && !played && (
              <div className={`${panel} mb-4 flex flex-col gap-3`}>
                <p className="text-sm text-muted">
                  BookOn puts entries into groups of up to {GROUP_SIZE}, keeping teams together.
                  {groupCount > 0 && " Making it again replaces the groups below."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={makeStartSheetInOrder}>
                    {hidden}
                    <button type="submit" className={secondaryButton}>
                      Make start sheet, in order of entry
                    </button>
                  </form>
                  <form action={makeStartSheetShuffled}>
                    {hidden}
                    <button type="submit" className={secondaryButton}>
                      Make start sheet, shuffled
                    </button>
                  </form>
                </div>
              </div>
            )}
            {groupCount > 0 && (
              <ol className="flex flex-col gap-3">
                {groups.map((g) => (
                  <li key={g.group} className="rounded-xl border border-border p-3">
                    <p className="font-semibold">
                      Group {g.group} · {groupStartLabel(event, g.group)}
                      <span className="ml-2 text-sm font-normal text-muted">
                        {g.entries.reduce((n, e) => n + e.playerCount, 0)} of {GROUP_SIZE}
                      </span>
                    </p>
                    {g.entries.length === 0 && <p className="text-sm text-muted">Empty</p>}
                    <ul className="mt-1 flex flex-col gap-2 text-sm">
                      {g.entries.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span>{e.players.map((p) => p.name).join(", ")}</span>
                          {open && !played && (
                            <form action={moveEntry} className="flex items-center gap-2">
                              {hidden}
                              <input type="hidden" name="entryId" value={e.id} />
                              <label className="sr-only" htmlFor={`group-${e.id}`}>
                                Move to group
                              </label>
                              <select
                                id={`group-${e.id}`}
                                name="group"
                                defaultValue={String(g.group)}
                                className={`${textInput} min-h-11 w-auto`}
                              >
                                {Array.from({ length: moveChoices }, (_, i) => (
                                  <option key={i} value={i + 1}>
                                    Group {i + 1}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className={secondaryButton}>
                                Move
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            {unplaced.length > 0 && groupCount > 0 && (
              <p className="mt-3 text-sm text-warning-fg">
                Not in a group yet: {unplaced.map((e) => e.contactName).join(", ")}. Make the start
                sheet again to place them.
              </p>
            )}
            {groupCount > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {open && !played && (
                  <form action={publishClubStartSheet}>
                    {hidden}
                    <button type="submit" className={primaryButton}>
                      {event.startSheetPublishedAt
                        ? "Send everyone their start again"
                        : "Publish and email everyone"}
                    </button>
                  </form>
                )}
                <a href={`${base}/print`} className={secondaryButton}>
                  Print
                </a>
                <a href={`${base}/start-sheet.csv`} className={secondaryButton}>
                  Download (CSV)
                </a>
              </div>
            )}
            {event.startSheetPublishedAt && open && !played && (
              <p className="mt-2 text-sm text-muted">
                It&apos;s published, so moving a team emails just that team their new start.
              </p>
            )}
          </>
        )}
      </section>

      <section id="results" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-lg font-semibold">Results</h2>
        <form action={saveEventResults} className="flex flex-col gap-3">
          {hidden}
          <label htmlFor="results" className="text-sm text-muted">
            Placings, winners and prizes, as you&apos;d like golfers to see them on the event page.
            BookOn doesn&apos;t work out scores.
          </label>
          <textarea
            id="results"
            name="results"
            rows={6}
            maxLength={4000}
            defaultValue={event.results ?? ""}
            placeholder={
              "1st: Smith and Jones, 58.5\n2nd: Brown and Lee, 60\nNearest the pin (8th): Sam Brown"
            }
            className={`${textInput} py-2`}
          />
          <button type="submit" className={`${secondaryButton} self-start`}>
            Save results
          </button>
        </form>
      </section>

      {open && !played && (
        <section id="cancel" className="mb-8">
          <details>
            <summary className="cursor-pointer font-medium text-brand">Cancel this event</summary>
            <form action={cancelClubEvent} className="mt-3 flex flex-col gap-3">
              {hidden}
              <p className="text-sm text-muted">
                Everyone who entered is refunded in full, including BookOn&apos;s booking fee, and
                emailed.
              </p>
              <label className="sr-only" htmlFor="cancel-note">
                Note to golfers
              </label>
              <input
                id="cancel-note"
                name="note"
                maxLength={300}
                placeholder="Sorry, … (optional)"
                className={textInput}
              />
              <button type="submit" className={`${secondaryButton} self-start`}>
                Cancel event and refund everyone
              </button>
            </form>
          </details>
        </section>
      )}
    </>
  );
}
