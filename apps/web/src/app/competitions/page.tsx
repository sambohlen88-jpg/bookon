import type { Metadata } from "next";
import Link from "next/link";
import { AREAS, addPerthDays, isoWeekday, perthDate } from "@bookon/core";
import { openComps, upcomingOpenEvents } from "@bookon/db";
import { CompetitionList } from "@/components/competition-list";
import { CompCards } from "@/components/matchplay/comp-cards";
import { SiteHeader } from "@/components/site-header";
import { listedCompetition } from "@/lib/competitions";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Golf competitions near you · BookOn",
  description:
    "Open golf competitions and social days at Perth and WA clubs. See the format, fee and places left, and enter online.",
};

/** "Open competitions near you" (Milestone 21): every club's open events, to enter on BookOn. */
export default async function CompetitionsPage() {
  const now = new Date();
  const today = perthDate(now);
  const events = (await upcomingOpenEvents(getDb(), now)).map((e) => listedCompetition(e, now));
  // Match play (Milestone 22): paid ones only once the club can take payments.
  const comps = (await openComps(getDb(), now)).filter((c) => !c.feeCents || c.clubPaymentsReady);
  const areas = AREAS.filter((a) => events.some((e) => e.area === a.id)).map((a) => ({
    id: a.id,
    name: a.name,
  }));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:max-w-4xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Competitions</h1>
        <p className="mt-2 max-w-2xl text-muted md:text-lg">
          Open competitions and social days at clubs around Perth and WA. Enter and pay online, on
          your own or with your team.
        </p>
        {events.length === 0 ? (
          comps.length === 0 && (
            <p className="mt-8 rounded-xl border border-border p-4 text-muted">
              No open competitions listed right now. Check back soon.
            </p>
          )
        ) : (
          <CompetitionList
            events={events}
            areas={areas}
            weekEnd={addPerthDays(today, 7 - isoWeekday(today))}
            monthEnd={addPerthDays(today, 27)}
          />
        )}
        {comps.length > 0 && (
          <section aria-labelledby="matchplay" className="mt-12">
            <h2 id="matchplay" className="text-2xl font-semibold">
              Match play
            </h2>
            <p className="mb-4 mt-1 text-muted">
              Knockout competitions: you arrange each match with your opponent and play it by the
              date set.
            </p>
            <CompCards comps={comps} now={now} />
          </section>
        )}
        <div className="mt-12 rounded-xl bg-surface p-5 md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="font-semibold">Run a club?</h2>
            <p className="mt-1 text-sm text-muted">
              Take entries and payments for your events, make start sheets, and run match play
              draws.
            </p>
          </div>
          <Link
            href="/clubs"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline md:mt-0"
          >
            For golf clubs
          </Link>
        </div>
      </main>
    </>
  );
}
