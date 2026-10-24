import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MATCH_REMINDER_DAYS,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
  roundCount,
  roundName,
} from "@bookon/core";
import {
  drawSizeFor,
  endedMpEntries,
  entriesForComp,
  listedComp,
  matchesForComp,
  type MatchplayEntry,
  type MatchplayMatch,
} from "@bookon/db";
import {
  addMatchplayEntry,
  awardWalkover,
  cancelMatchplay,
  makeMatchplayDraw,
  publishMatchplayDraw,
  recordMatchResult,
  reopenMatchplayEntries,
  saveRoundDates,
  saveSeeds,
  swapMatchplayDraw,
  withdrawMpEntryNoRefund,
  withdrawMpEntryWithRefund,
} from "@/app/club/[clubId]/matchplay/actions";
import { PageTitle, Pill, panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Field, fieldLabel } from "@/components/form";
import { Bracket } from "@/components/matchplay/bracket";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { COMP_STATUS, bracketSides, sideLabel } from "@/lib/matchplay";
import { siteOrigin } from "@/lib/site";

const DONE: Record<string, string> = {
  created: "Your competition is set up. Add entries, or share the link below so golfers can enter.",
  saved: "Saved.",
  added: "Entry added.",
  withdrawn: "Withdrawn.",
  seeds: "Seeds saved.",
  drawn: "Draw made. Check it, swap anyone you need to, set the play-by dates, then publish it.",
  reopened: "The draw is undone, so you can change the entries.",
  swapped: "Swapped.",
  dates: "Play-by dates saved.",
  published: "The draw is out. Everyone with an email has been sent their first match.",
  result: "Result saved. The winner goes through, and both sides have been emailed.",
  walkover: "Walkover awarded. The winner goes through, and both sides have been emailed.",
  cancelled: "Cancelled. Anyone who paid is being refunded in full, and we've emailed everyone.",
};

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

const MATCH_STATUS: Record<string, string> = {
  "to-play": "To play",
  reported: "Reported",
  disputed: "Disputed",
  done: "Done",
};

/** One match play competition in the club portal (Milestone 22): entries, draw, results. */
export default async function ClubMatchplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string; compId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId, compId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/matchplay/${compId}`);
  const db = getDb();
  const now = new Date();
  const comp = await listedComp(db, compId, now);
  if (!comp || comp.clubId !== club.id) notFound();
  const query = await searchParams;
  const entries = await entriesForComp(db, comp.id);
  const ended = await endedMpEntries(db, comp.id);
  const matches = await matchesForComp(db, comp.id);
  const sides = bracketSides([...entries, ...ended]);
  const byId = new Map<string, MatchplayEntry>([...entries, ...ended].map((e) => [e.id, e]));
  const publicLink = `${await siteOrigin()}/matchplay/${comp.id}`;
  const base = `/club/${club.id}/matchplay/${comp.id}`;
  const taking = comp.status === "entries";
  const drawn = comp.status === "drawn";
  const live = comp.status === "playing";
  const settled = comp.status === "finished" || comp.status === "cancelled";
  const rounds = comp.drawSize ? roundCount(comp.drawSize) : 0;
  const size = drawSizeFor(entries.length);
  const champion = comp.winnerEntryId ? byId.get(comp.winnerEntryId) : undefined;
  const hidden = (
    <>
      <input type="hidden" name="clubId" value={club.id} />
      <input type="hidden" name="compId" value={comp.id} />
    </>
  );

  // Matches the club may need to act on: disputed first, then by round.
  const order = { disputed: 0, reported: 1, "to-play": 2, done: 3, waiting: 4 } as const;
  const playable = matches
    .filter((m) => m.status !== "waiting" && m.score !== "Bye")
    .sort(
      (a, b) =>
        order[a.status as keyof typeof order] - order[b.status as keyof typeof order] ||
        a.round - b.round ||
        a.slot - b.slot,
    );

  return (
    <>
      <Link href={`/club/${club.id}/matchplay`} className="text-sm font-medium text-brand">
        ← Match play
      </Link>
      <PageTitle title={comp.title} />
      <div className="mb-4 flex flex-col gap-2">
        {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
        {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        {comp.status === "cancelled" && (
          <Notice tone="warning">
            This competition is cancelled{comp.cancelNote ? `: "${comp.cancelNote}"` : "."}
          </Notice>
        )}
        {champion && (
          <Notice tone="info">
            <strong>{sideLabel(champion)}</strong> won {comp.title}.
          </Notice>
        )}
      </div>

      <section className={`${panel} mb-6`}>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Status</dt>
          <dd>{COMP_STATUS[comp.status]}</dd>
          <dt className="text-muted">Format</dt>
          <dd>
            {comp.teamSize === 2 ? "Pairs" : "Singles"} knockout, {comp.courseName}
          </dd>
          <dt className="text-muted">Entries</dt>
          <dd>
            <strong>
              {entries.length} of {comp.maxEntries}
            </strong>
            {comp.onlineEntry
              ? `, online ${comp.feeCents > 0 ? `at ${formatPrice(comp.feeCents)} a player` : "for free"}${comp.entriesClose ? ` until ${when(comp.entriesClose)}` : ""}`
              : ", added by the club"}
          </dd>
          <dt className="text-muted">Who can see it</dt>
          <dd>{comp.open ? "Anyone (listed on BookOn)" : "Members only (not listed)"}</dd>
        </dl>
        <p className="mt-3 text-sm">
          Link for players:{" "}
          <a href={publicLink} className="break-all text-brand underline">
            {publicLink}
          </a>
        </p>
        {taking && (
          <div className="mt-4">
            <Link href={`${base}/edit`} className={secondaryButton}>
              Change details
            </Link>
          </div>
        )}
      </section>

      <section id="entries" className="mb-8 scroll-mt-4">
        <h2 className="mb-3 text-lg font-semibold">Entries</h2>
        {entries.length === 0 ? (
          <p className="text-muted">No entries yet.</p>
        ) : (
          <>
            {(taking || drawn) && (
              <p className="mb-2 text-sm text-muted">
                Seeds are optional: 1 is the top seed. Seeds are kept apart in the draw and get any
                byes; everyone else is drawn at random.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Seed</th>
                    <th className={thClass}>Entry</th>
                    <th className={thClass}>Contact</th>
                    <th className={`${thClass} text-right`}>Paid</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className={tdClass}>
                        {taking ? (
                          <div className="w-16">
                            <label className="sr-only" htmlFor={`seed-${e.id}`}>
                              Seed for {sideLabel(e)}
                            </label>
                            <input
                              id={`seed-${e.id}`}
                              form="seeds"
                              name={`seed-${e.id}`}
                              type="number"
                              min={1}
                              max={comp.maxEntries}
                              defaultValue={e.seed ?? ""}
                              className={`${textInput} min-h-11`}
                            />
                          </div>
                        ) : (
                          <span className="tabular-nums">{e.seed ?? ""}</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {sideLabel(e)}
                        <span className="block text-muted">
                          {e.source === "club" ? "Added by the club" : "Entered online"}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {e.contactPhone && (
                          <a href={`tel:${e.contactPhone}`} className="block text-brand">
                            {formatAuPhone(e.contactPhone)}
                          </a>
                        )}
                        {e.contactEmail ? (
                          <a
                            href={`mailto:${e.contactEmail}`}
                            className="block break-all text-brand"
                          >
                            {e.contactEmail}
                          </a>
                        ) : (
                          <span className="block text-muted">No email, so no emails from us</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {e.feesCents > 0 ? formatPrice(e.feesCents) : ""}
                      </td>
                      <td className={tdClass}>
                        {taking && (
                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-brand">
                              Withdraw
                            </summary>
                            <div className="mt-2 flex flex-col gap-2">
                              {e.feesCents > 0 ? (
                                <>
                                  <form
                                    action={withdrawMpEntryWithRefund}
                                    className="flex flex-col gap-2"
                                  >
                                    {hidden}
                                    <input type="hidden" name="entryId" value={e.id} />
                                    <label className="sr-only" htmlFor={`note-${e.id}`}>
                                      Note to the player
                                    </label>
                                    <input
                                      id={`note-${e.id}`}
                                      name="note"
                                      maxLength={300}
                                      placeholder="Note to the player (optional)"
                                      className={`${textInput} min-h-11`}
                                    />
                                    <button type="submit" className={secondaryButton}>
                                      Withdraw and refund{" "}
                                      {formatPrice(e.feesCents + e.bookingFeeCents)}
                                    </button>
                                  </form>
                                  <form action={withdrawMpEntryNoRefund}>
                                    {hidden}
                                    <input type="hidden" name="entryId" value={e.id} />
                                    <button type="submit" className={secondaryButton}>
                                      Withdraw, no refund
                                    </button>
                                  </form>
                                </>
                              ) : (
                                <form action={withdrawMpEntryNoRefund}>
                                  {hidden}
                                  <input type="hidden" name="entryId" value={e.id} />
                                  <button type="submit" className={secondaryButton}>
                                    Withdraw {sideLabel(e)}
                                  </button>
                                </form>
                              )}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {taking && (
              <form id="seeds" action={saveSeeds} className="mt-3">
                {hidden}
                <button type="submit" className={secondaryButton}>
                  Save seeds
                </button>
              </form>
            )}
          </>
        )}

        {taking && (
          <details className={`${panel} mt-4`} open={entries.length === 0}>
            <summary className="cursor-pointer font-medium">Add an entry</summary>
            <form action={addMatchplayEntry} className="mt-3 flex flex-col gap-3">
              {hidden}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={comp.teamSize === 2 ? "First player" : "Player"}
                  name="player0"
                  required
                  maxLength={80}
                />
                {comp.teamSize === 2 && (
                  <Field label="Second player" name="player1" required maxLength={80} />
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" name="email" type="email" maxLength={254} />
                <Field label="Mobile" name="phone" type="tel" maxLength={20} />
              </div>
              <p className="text-sm text-muted">
                An email or a mobile, so opponents can reach them. Only players with an email get
                BookOn&apos;s emails; their opponents get these details by email, not on the draw.
              </p>
              <button type="submit" className={`${secondaryButton} self-start`}>
                Add entry
              </button>
            </form>
          </details>
        )}

        {ended.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Withdrawn and cancelled ({ended.length})
            </summary>
            <ul className="mt-2">
              {ended.map((e) => (
                <li key={e.id} className="border-t border-border py-2 first:border-t-0">
                  {sideLabel(e)} ·{" "}
                  {e.cancelledBy === "golfer"
                    ? "withdrew"
                    : e.cancelledBy === "club"
                      ? "withdrawn by the club"
                      : "competition cancelled"}
                  {e.feesCents > 0 &&
                    (e.refundCents > 0
                      ? `, refunded ${formatPrice(e.refundCents)}`
                      : ", not refunded")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section id="draw" className="mb-8 scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Draw</h2>
          {comp.publishedAt ? (
            <Pill tone="good">Out since {when(comp.publishedAt)}</Pill>
          ) : (
            drawn && <Pill tone="warn">Not out yet</Pill>
          )}
        </div>

        {taking &&
          (entries.length < 2 ? (
            <p className="text-muted">Once there are two entries or more, you can make the draw.</p>
          ) : (
            <div className={`${panel} flex flex-col gap-3`}>
              <p className="text-sm">
                {entries.length} entries make a draw of {size}
                {size > entries.length
                  ? `, so ${size - entries.length} ${size - entries.length === 1 ? "entry gets a bye" : "entries get byes"} through the first round, top seeds first`
                  : ""}
                . Making the draw stops new entries; you can undo it until it&apos;s out.
              </p>
              <form action={makeMatchplayDraw}>
                {hidden}
                <button type="submit" className={`${primaryButton} self-start`}>
                  Make the draw
                </button>
              </form>
            </div>
          ))}

        {matches.length > 0 && <Bracket matches={matches} rounds={comp.rounds} sides={sides} />}

        {drawn && (
          <div className="mt-4 flex flex-col gap-4">
            <form action={swapMatchplayDraw} className={`${panel} flex flex-col gap-3`}>
              {hidden}
              <p className="font-medium">Swap two entries</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["first", "second"] as const).map((name) => (
                  <div key={name}>
                    <label htmlFor={`swap-${name}`} className="sr-only">
                      {name === "first" ? "First entry" : "Second entry"}
                    </label>
                    <select id={`swap-${name}`} name={name} className={textInput}>
                      {entries.map((e) => (
                        <option key={e.id} value={e.id}>
                          {sideLabel(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button type="submit" className={`${secondaryButton} self-start`}>
                Swap
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={makeMatchplayDraw}>
                {hidden}
                <button type="submit" className={secondaryButton}>
                  Make the draw again
                </button>
              </form>
              <form action={reopenMatchplayEntries}>
                {hidden}
                <button type="submit" className={secondaryButton}>
                  Undo the draw and change entries
                </button>
              </form>
            </div>
          </div>
        )}

        {rounds > 0 && !settled && (
          <form action={saveRoundDates} className={`${panel} mt-4 flex flex-col gap-3`}>
            {hidden}
            <p className="font-medium">Play-by dates</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: rounds }, (_, i) => (
                <div key={i}>
                  <label htmlFor={`playBy-${i}`} className={fieldLabel}>
                    {roundName(i + 1, rounds)}
                  </label>
                  <input
                    id={`playBy-${i}`}
                    name="playBy"
                    type="date"
                    defaultValue={comp.rounds[i]?.playBy ?? ""}
                    className={textInput}
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">
              Players are reminded {MATCH_REMINDER_DAYS} days before, and you&apos;re told about any
              match still without a result after its date.
            </p>
            <button type="submit" className={`${secondaryButton} self-start`}>
              Save dates
            </button>
          </form>
        )}

        {drawn && (
          <form action={publishMatchplayDraw} className="mt-4">
            {hidden}
            <button type="submit" className={primaryButton}>
              Publish the draw and email everyone
            </button>
            <p className="mt-2 text-sm text-muted">
              Each side is emailed their opponent, how to reach them, and the date to play by.
            </p>
          </form>
        )}
      </section>

      {(live || comp.status === "finished") && playable.length > 0 && (
        <section id="matches" className="mb-8 scroll-mt-4">
          <h2 className="mb-1 text-lg font-semibold">Matches</h2>
          <p className="mb-3 text-sm text-muted">
            Players report results, and the other side has 48 hours to dispute. You can record or
            correct any result, or award a walkover.
          </p>
          <ul className="flex flex-col gap-3">
            {playable.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                rounds={rounds}
                playBy={comp.rounds[m.round - 1]?.playBy ?? null}
                byId={byId}
                hidden={hidden}
                now={now}
              />
            ))}
          </ul>
        </section>
      )}

      {!settled && (
        <section id="cancel" className="mb-8">
          <details>
            <summary className="cursor-pointer font-medium text-brand">
              Cancel this competition
            </summary>
            <form action={cancelMatchplay} className="mt-3 flex flex-col gap-3">
              {hidden}
              <p className="text-sm text-muted">
                Anyone who paid is refunded in full, including BookOn&apos;s booking fee, and
                everyone with an email is told.
              </p>
              <label className="sr-only" htmlFor="cancel-note">
                Note to players
              </label>
              <input
                id="cancel-note"
                name="note"
                maxLength={300}
                placeholder="Sorry, … (optional)"
                className={textInput}
              />
              <button type="submit" className={`${secondaryButton} self-start`}>
                Cancel the competition
              </button>
            </form>
          </details>
        </section>
      )}
    </>
  );
}

function MatchRow({
  match,
  rounds,
  playBy,
  byId,
  hidden,
  now,
}: {
  match: MatchplayMatch;
  rounds: number;
  playBy: string | null;
  byId: Map<string, MatchplayEntry>;
  hidden: React.ReactNode;
  now: Date;
}) {
  const a = byId.get(match.entryA!)!;
  const b = byId.get(match.entryB!)!;
  const winner = match.winnerEntryId ? byId.get(match.winnerEntryId) : undefined;
  const reporter = match.reportedBy ? byId.get(match.reportedBy) : undefined;
  const overdue = playBy && match.status === "to-play" && perthDate(now) > playBy;
  const ids = `m-${match.id}`;
  return (
    <li
      id={`match-${match.id}`}
      className={`scroll-mt-4 rounded-xl border p-3 ${match.status === "disputed" ? "border-warning-border bg-warning-bg" : "border-border"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {sideLabel(a)} v {sideLabel(b)}
        </p>
        <Pill
          tone={
            match.status === "done"
              ? "muted"
              : match.status === "disputed" || overdue
                ? "warn"
                : "good"
          }
        >
          {overdue ? "Overdue" : MATCH_STATUS[match.status]}
        </Pill>
      </div>
      <p className="text-sm text-muted">
        {roundName(match.round, rounds)}
        {playBy ? ` · play by ${formatPerthDay(playBy)}` : ""}
      </p>
      {winner && (
        <p className="mt-1 text-sm">
          {match.status === "done" ? "Won by" : "Reported win for"}{" "}
          <strong>{sideLabel(winner)}</strong>
          {match.score === "Walkover" ? ", walkover" : match.score ? ` ${match.score}` : ""}
          {match.status !== "done" && reporter && `, reported by ${sideLabel(reporter)}`}
          {match.status === "reported" && match.disputeBy && `. Stands ${when(match.disputeBy)}.`}
        </p>
      )}
      {match.status === "disputed" && match.disputeNote && (
        <p className="mt-1 text-sm">
          {sideLabel(match.reportedBy === a.id ? b : a)} said: &ldquo;{match.disputeNote}&rdquo;
        </p>
      )}
      <details className="mt-2" open={match.status === "disputed"}>
        <summary className="cursor-pointer text-sm font-medium text-brand">
          {match.status === "done" ? "Correct the result" : "Record the result"}
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <form action={recordMatchResult} className="flex flex-col gap-2">
            {hidden}
            <input type="hidden" name="matchId" value={match.id} />
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-medium">Winner</legend>
              {[a, b].map((e) => (
                <label key={e.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="winner"
                    value={e.id}
                    required
                    defaultChecked={match.winnerEntryId === e.id}
                    className="size-5 accent-brand"
                  />
                  {sideLabel(e)}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${ids}-score`} className="text-sm font-medium">
              Score (optional)
            </label>
            <input
              id={`${ids}-score`}
              name="score"
              maxLength={30}
              placeholder="3&2, 1 up, 19th"
              defaultValue={match.score && match.score !== "Walkover" ? match.score : ""}
              className={`${textInput} min-h-11 max-w-xs`}
            />
            <button type="submit" className={`${secondaryButton} self-start`}>
              Save result
            </button>
          </form>
          <form action={awardWalkover} className="flex flex-wrap items-end gap-2">
            {hidden}
            <input type="hidden" name="matchId" value={match.id} />
            <div>
              <label htmlFor={`${ids}-wo`} className="text-sm font-medium">
                Walkover to
              </label>
              <select id={`${ids}-wo`} name="winner" className={`${textInput} min-h-11`}>
                {[a, b].map((e) => (
                  <option key={e.id} value={e.id}>
                    {sideLabel(e)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={secondaryButton}>
              Award walkover
            </button>
          </form>
        </div>
      </details>
    </li>
  );
}
