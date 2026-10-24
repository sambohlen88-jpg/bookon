import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import {
  clubById,
  endedMpEntries,
  entriesForComp,
  eventPaymentSettings,
  listedComp,
  matchesForComp,
  mpEntryById,
} from "@bookon/db";
import { abandonMpCheckout, clubTakesEntries } from "@bookon/payments";
import { enterMatchplay } from "@/app/matchplay/[id]/actions";
import { Checkbox, Field } from "@/components/form";
import { Bracket } from "@/components/matchplay/bracket";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";
import { bracketSides, sideLabel } from "@/lib/matchplay";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const comp = await listedComp(getDb(), (await params).id, new Date());
  if (!comp) return { title: "Competition not found · BookOn" };
  return {
    title: `${comp.title}, ${comp.clubName} · BookOn`,
    description: `${comp.teamSize === 2 ? "Pairs" : "Singles"} match play at ${comp.courseName}. Entries and the draw.`,
    // Members-only competitions are shared by link, not found by search engines.
    ...(comp.open ? {} : { robots: { index: false } }),
  };
}

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;

/** A match play competition (Milestone 22): details, entering, and the draw sheet once it's out. */
export default async function MatchplayPage({
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

  // Back from the checkout page without paying: free the place now.
  if (ctx && query.cancelled) {
    const left = await mpEntryById(db, query.cancelled);
    if (left && left.compId === id) await abandonMpCheckout(ctx, left);
  }

  const comp = await listedComp(db, id, now);
  if (!comp) notFound();
  const club = (await clubById(db, comp.clubId))!;
  const paid = comp.feeCents > 0;
  const taking = !paid || (ctx ? await clubTakesEntries(ctx, club) : false);
  const { feeCents } = await eventPaymentSettings(db);
  const cancelled = comp.status === "cancelled";
  const closed = comp.entriesClose !== null && comp.entriesClose <= now;
  const full = comp.entered >= comp.maxEntries;
  const entering = comp.status === "entries" && comp.onlineEntry;
  const canEnter = entering && taking && !closed && !full;
  const user = canEnter ? await currentUser() : null;
  const published = Boolean(comp.publishedAt) && !cancelled;
  const matches = published ? await matchesForComp(db, comp.id) : [];
  const entries = published
    ? [...(await entriesForComp(db, comp.id)), ...(await endedMpEntries(db, comp.id))]
    : [];
  const champion = comp.winnerEntryId
    ? entries.find((e) => e.id === comp.winnerEntryId)
    : undefined;
  const entryTotal = comp.feeCents * comp.teamSize + (paid ? feeCents : 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:max-w-5xl md:px-6 md:pt-10">
        <Link href="/competitions" className="text-sm font-medium text-brand">
          ← Competitions
        </Link>
        <p className="mt-4 text-sm font-medium text-muted">
          {comp.clubName}
          {comp.open ? "" : " · members only"}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{comp.title}</h1>
        <p className="mt-2 text-lg">
          {comp.teamSize === 2 ? "Pairs" : "Singles"} match play, knockout
        </p>
        <p className="text-muted">
          <Link href={`/courses/${comp.courseSlug}`} className="text-brand">
            {comp.courseName}
          </Link>
          , {comp.suburb}
        </p>
        {comp.description && (
          <p className="mt-4 max-w-2xl whitespace-pre-line">{comp.description}</p>
        )}

        <div className="mt-4 flex max-w-2xl flex-col gap-3">
          {query.cancelled && (
            <Notice tone="info">No problem, you haven&apos;t paid anything.</Notice>
          )}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {cancelled && (
            <Notice tone="warning">
              {comp.clubName} has cancelled this competition
              {comp.cancelNote ? `: "${comp.cancelNote}"` : "."} Anyone who paid has been refunded.
            </Notice>
          )}
          {champion && (
            <Notice tone="info">
              <strong>{sideLabel(champion)}</strong> won {comp.title}. Congratulations!
            </Notice>
          )}
        </div>

        {comp.status === "entries" && (
          <dl className="mt-5 grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border p-4">
            <dt className="text-muted">Entry</dt>
            <dd>
              {!comp.onlineEntry ? (
                "Through the club"
              ) : paid ? (
                <>
                  <strong className="tabular-nums">{formatPrice(comp.feeCents)}</strong> a player
                </>
              ) : (
                "Free"
              )}
            </dd>
            <dt className="text-muted">Entries</dt>
            <dd className={full ? "font-semibold" : ""}>
              {full ? "Full" : `${comp.entered} of ${comp.maxEntries}`}
            </dd>
            {comp.entriesClose && (
              <>
                <dt className="text-muted">Entries close</dt>
                <dd>
                  {when(comp.entriesClose)}
                  {closed && " (closed)"}
                </dd>
              </>
            )}
          </dl>
        )}

        {comp.status === "drawn" && (
          <p className="mt-6 text-muted">
            Entries have closed and {comp.clubName} is making the draw. It&apos;ll show here when
            it&apos;s out.
          </p>
        )}

        {published && (
          <section aria-labelledby="draw" className="mt-8">
            <h2 id="draw" className="mb-3 text-xl font-semibold">
              The draw
            </h2>
            <Bracket matches={matches} rounds={comp.rounds} sides={bracketSides(entries)} />
            <p className="mt-2 text-sm text-muted">
              Players arrange each match themselves and play it by the date shown. Results show as
              they come in.
            </p>
          </section>
        )}

        {entering && !cancelled && (
          <section
            id="enter"
            aria-labelledby="enter-heading"
            className="mt-8 max-w-2xl scroll-mt-4"
          >
            <h2 id="enter-heading" className="text-xl font-semibold">
              Enter
            </h2>
            {!taking ? (
              <p className="mt-2 text-muted">
                {comp.clubName} isn&apos;t taking entries through BookOn right now. Contact the club
                to enter.
              </p>
            ) : closed ? (
              <p className="mt-2 text-muted">
                Entries have closed. Contact the club if you&apos;d still like to play.
              </p>
            ) : full ? (
              <p className="mt-2 text-muted">Sorry, the field is full.</p>
            ) : (
              <form action={enterMatchplay} className="mt-3 flex flex-col gap-4">
                <input type="hidden" name="compId" value={comp.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Your name"
                    name="player0"
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
                  {comp.teamSize === 2 && (
                    <Field
                      label="Your partner's name"
                      name="player1"
                      required
                      maxLength={80}
                      autoComplete="off"
                    />
                  )}
                </div>
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={user?.email}
                  hint="We email you each opponent and the date to play by."
                />
                <Field
                  label="Mobile"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  autoComplete="tel"
                  hint="So your opponents can call or text to arrange a time."
                />
                <section
                  aria-label="Summary"
                  className="rounded-xl border border-border bg-surface p-4 text-sm"
                >
                  <p className="font-semibold">
                    {paid
                      ? `${comp.teamSize === 2 ? "2 players" : "1 player"} at ${formatPrice(comp.feeCents)}, plus a ${formatPrice(feeCents)} booking fee: ${formatPrice(entryTotal)}`
                      : "Free to enter"}
                  </p>
                  <ul className="mt-3 list-disc pl-5 text-muted">
                    {paid && <li>Your card is charged when you enter.</li>}
                    <li>
                      You can withdraw until the club makes the draw
                      {paid ? ", for a full refund" : ""}. After that, contact the club.
                    </li>
                    <li>
                      When the draw is out, we&apos;ll email you your opponent, their mobile and
                      email, and the date to play by. They get yours.
                    </li>
                    <li>
                      {comp.teamSize === 2 ? "Your names go" : "Your name goes"} on the draw sheet.
                      Contact details never do.
                    </li>
                  </ul>
                </section>
                <Checkbox name="agree" value="yes" required>
                  I agree to BookOn sharing my email and mobile with {comp.clubName} and with each
                  opponent, to arrange our matches.
                </Checkbox>
                <button type="submit" className={primaryButton}>
                  {paid ? "Continue to payment" : "Enter"}
                </button>
                {paid && (
                  <p className="text-center text-sm text-muted">
                    {ctx?.payments.kind === "practice"
                      ? "Practice payments: no money moves on this computer."
                      : "Payment is on Stripe's secure page. BookOn never sees your card."}
                  </p>
                )}
              </form>
            )}
          </section>
        )}
        {comp.status === "entries" && !comp.onlineEntry && !cancelled && (
          <p className="mt-8 max-w-2xl text-muted">
            {comp.clubName} takes entries for this competition. Contact the club to enter.
          </p>
        )}
        <p className="mt-10 text-xs text-muted">
          {comp.clubName} runs this competition and has the final say on results.
        </p>
      </main>
    </>
  );
}
