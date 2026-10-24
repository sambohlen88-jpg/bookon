import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate, roundName } from "@bookon/core";
import {
  endedMpEntries,
  entriesForComp,
  listedComp,
  matchesForComp,
  mpEntryByToken,
  type MatchplayMatch,
} from "@bookon/db";
import { checkMpCheckout } from "@bookon/payments";
import {
  confirmMpResult,
  disputeMpResult,
  reportMpResult,
  withdrawMpFromLink,
} from "@/app/matchplay/entry/[token]/actions";
import { Bracket } from "@/components/matchplay/bracket";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { bracketSides, sideLabel } from "@/lib/matchplay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your match play · BookOn", robots: { index: false } };

const DONE: Record<string, string> = {
  reported: "Thanks. We've asked your opponent to confirm it.",
  confirmed: "Thanks, the result stands.",
  disputed: "Thanks. We've told the club, and they'll be in touch.",
  withdrawn: "Done. We've emailed you to confirm.",
};

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

/** A player's own page for a match play entry, from the link in their emails (Milestone 22). */
export default async function MatchplayEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = getDb();
  const { token } = await params;
  const query = await searchParams;
  let entry = await mpEntryByToken(db, token);
  if (!entry) notFound();
  const ctx = await lessonContext();
  // Back from Stripe: check the payment went through, in case its message hasn't arrived yet.
  if (ctx && entry.status === "checkout") entry = await checkMpCheckout(ctx, entry);
  const now = ctx?.now ?? new Date();
  const comp = (await listedComp(db, entry.compId, now))!;
  const published = Boolean(comp.publishedAt) && comp.status !== "cancelled";
  const matches = published ? await matchesForComp(db, comp.id) : [];
  const everyone = published
    ? [...(await entriesForComp(db, comp.id)), ...(await endedMpEntries(db, comp.id))]
    : [];
  const byId = new Map(everyone.map((e) => [e.id, e]));
  const rounds = comp.drawSize ? Math.log2(comp.drawSize) : 0;
  const mine = matches.filter((m) => m.entryA === entry!.id || m.entryB === entry!.id);
  // A match waiting for its other side isn't one they can play yet.
  const current = mine.filter((m) => m.status !== "done" && m.status !== "waiting").at(-1);
  const last = mine.filter((m) => m.status === "done").at(-1);
  const out = last && last.winnerEntryId !== entry.id;
  const won = comp.winnerEntryId === entry.id;
  const paid = entry.feesCents + entry.bookingFeeCents;
  const hidden = <input type="hidden" name="token" value={token} />;

  const headline =
    entry.status === "checkout"
      ? "Waiting for payment"
      : entry.status === "withdrawn"
        ? "Withdrawn"
        : entry.status === "abandoned"
          ? "Not entered"
          : comp.status === "cancelled"
            ? "Competition cancelled"
            : won
              ? "You won!"
              : out
                ? "You're out"
                : current
                  ? "Your match"
                  : published
                    ? "Waiting for your next opponent"
                    : "You're entered";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6 md:max-w-5xl md:px-6 md:pt-10">
        <p className="text-sm font-medium text-muted">
          <Link href={`/matchplay/${comp.id}`} className="text-brand">
            {comp.title}
          </Link>
          , {comp.clubName}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{headline}</h1>
        <p className="mt-1 text-muted">{sideLabel(entry)}</p>

        <div className="mt-4 flex max-w-xl flex-col gap-3">
          {query.entered && (
            <Notice tone="info">
              You&apos;re in. We&apos;ve emailed you, and we&apos;ll email your first opponent when
              the draw is out.
            </Notice>
          )}
          {query.paid && entry.status === "entered" && (
            <Notice tone="info">
              Paid {formatPrice(paid)}. You&apos;re in, and we&apos;ve emailed your receipt.
            </Notice>
          )}
          {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {entry.status === "checkout" && (
            <Notice tone="info">
              {query.paid
                ? "We're checking your payment with Stripe. Refresh this page in a moment."
                : "This entry hasn't been paid for."}
            </Notice>
          )}
          {comp.status === "cancelled" && (
            <Notice tone="warning">
              {comp.clubName} cancelled this competition
              {comp.cancelNote ? `: "${comp.cancelNote}"` : "."}
              {entry.refundCents > 0 && ` You've been refunded ${formatPrice(entry.refundCents)}.`}
            </Notice>
          )}
          {entry.status === "withdrawn" && entry.refundCents > 0 && (
            <Notice tone="info">Refunded {formatPrice(entry.refundCents)} to your card.</Notice>
          )}
        </div>

        {entry.status === "entered" && current && (
          <CurrentMatch
            match={current}
            entryId={entry.id}
            opponent={byId.get(current.entryA === entry.id ? current.entryB! : current.entryA!)}
            round={roundName(current.round, rounds)}
            playBy={comp.rounds[current.round - 1]?.playBy ?? null}
            courseSlug={comp.courseSlug}
            clubName={comp.clubName}
            hidden={hidden}
            now={now}
          />
        )}

        {entry.status === "entered" && comp.status === "entries" && (
          <section className="mt-6 max-w-xl rounded-xl border border-border p-4">
            <p>
              When {comp.clubName} makes the draw, we&apos;ll email you your first opponent, their
              mobile and email, and the date to play by.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">Withdraw</summary>
              <form action={withdrawMpFromLink} className="mt-2">
                {hidden}
                <p className="mb-2 text-sm text-muted">
                  {paid > 0
                    ? `You'll be refunded ${formatPrice(paid)} in full.`
                    : "You can enter again while entries are open."}
                </p>
                <button type="submit" className={secondaryButton}>
                  Withdraw my entry
                </button>
              </form>
            </details>
          </section>
        )}

        {published && (
          <section aria-labelledby="draw" className="mt-8">
            <h2 id="draw" className="mb-3 text-xl font-semibold">
              The draw
            </h2>
            <Bracket
              matches={matches}
              rounds={comp.rounds}
              sides={bracketSides(everyone)}
              highlight={entry.id}
            />
          </section>
        )}
        <p className="mt-10 max-w-xl text-xs text-muted">
          {comp.clubName} runs this competition and has the final say on results. If you can&apos;t
          play a match, let the club know.
        </p>
      </main>
    </>
  );
}

function CurrentMatch({
  match,
  entryId,
  opponent,
  round,
  playBy,
  courseSlug,
  clubName,
  hidden,
  now,
}: {
  match: MatchplayMatch;
  entryId: string;
  opponent: Parameters<typeof sideLabel>[0] | undefined;
  round: string;
  playBy: string | null;
  courseSlug: string;
  clubName: string;
  hidden: React.ReactNode;
  now: Date;
}) {
  const them = opponent ? sideLabel(opponent) : "your opponent";
  const reportedByMe = match.reportedBy === entryId;
  const iWon = match.winnerEntryId === entryId;
  // "you won 3&2", "they won 3&2" (when they reported it), or "Bo Driver won 3&2".
  const reported = `${iWon ? "you" : reportedByMe ? them : "they"} won${match.score ? ` ${match.score}` : ""}`;
  return (
    <section className="mt-6 max-w-xl rounded-xl border border-border p-4">
      <p className="text-sm font-medium text-muted">{round}</p>
      <p className="mt-1 text-xl font-semibold">You v {them}</p>
      {playBy && (
        <p className="mt-1">
          Play by <strong>{formatPerthDay(playBy)}</strong>
          {perthDate(now) > playBy && match.status === "to-play" && " (overdue: let the club know)"}
        </p>
      )}
      {match.status === "to-play" && (
        <>
          <p className="mt-2 text-sm text-muted">
            Their mobile and email are in the email we sent you. Arrange a time, then either of you
            can report the result here.
          </p>
          <Link href={`/courses/${courseSlug}`} className={`${secondaryButton} mt-3`}>
            Find a tee time at {clubName}
          </Link>
          <form
            action={reportMpResult}
            className="mt-5 flex flex-col gap-3 border-t border-border pt-4"
          >
            {hidden}
            <input type="hidden" name="matchId" value={match.id} />
            <fieldset className="flex flex-col gap-1">
              <legend className="font-semibold">Played? Report the result</legend>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="won"
                  value="us"
                  required
                  className="size-5 accent-brand"
                />
                {opponent && opponent.players.length === 2 ? "We won" : "I won"}
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="won" value="them" className="size-5 accent-brand" />
                {them} won
              </label>
            </fieldset>
            <label htmlFor="score" className="text-sm font-medium">
              Score (optional)
            </label>
            <input
              id="score"
              name="score"
              maxLength={30}
              placeholder="3&2, 1 up, 19th"
              className={`${textInput} max-w-xs`}
            />
            <button type="submit" className={`${primaryButton} self-start`}>
              Report the result
            </button>
            <p className="text-sm text-muted">
              {them} can dispute it for 48 hours. After that it stands.
            </p>
          </form>
        </>
      )}
      {match.status === "reported" && reportedByMe && (
        <p className="mt-3">
          You reported that {reported}. It stands {when(match.disputeBy!)} unless {them} disputes
          it.
        </p>
      )}
      {match.status === "reported" && !reportedByMe && (
        <div className="mt-3 flex flex-col gap-3">
          <p>
            {them} reported that <strong>{reported}</strong>. If that&apos;s right, confirm it. If
            not, dispute it by {when(match.disputeBy!)} and the club will decide.
          </p>
          <form action={confirmMpResult}>
            {hidden}
            <input type="hidden" name="matchId" value={match.id} />
            <button type="submit" className={primaryButton}>
              That&apos;s right
            </button>
          </form>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand">
              That&apos;s not right
            </summary>
            <form action={disputeMpResult} className="mt-2 flex flex-col gap-2">
              {hidden}
              <input type="hidden" name="matchId" value={match.id} />
              <label htmlFor="note" className="text-sm font-medium">
                What happened? (for the club)
              </label>
              <input id="note" name="note" maxLength={300} className={textInput} />
              <button type="submit" className={`${secondaryButton} self-start`}>
                Dispute the result
              </button>
            </form>
          </details>
        </div>
      )}
      {match.status === "disputed" && (
        <p className="mt-3">
          The result ({reported}) is disputed. {clubName} will speak to you both and record it.
        </p>
      )}
    </section>
  );
}
