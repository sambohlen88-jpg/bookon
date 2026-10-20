import type { Metadata } from "next";
import Link from "next/link";
import { AREAS } from "@bookon/core";
import { listLiveCoaches } from "@bookon/db";
import { CoachDirectory } from "@/components/coach-directory";
import { GroupSessionList } from "@/components/group-session-list";
import { SiteHeader } from "@/components/site-header";
import { directoryCoach } from "@/lib/coaches";
import { getDb } from "@/lib/db";
import { bookableGroupSessions } from "@/lib/group-sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find a coach · BookOn",
  description:
    "PGA golf coaches around Perth: who's teaching this week and next, what they charge, and how to book a lesson.",
};

export default async function CoachesPage() {
  const now = new Date();
  const coaches = (await listLiveCoaches(getDb())).map((c) => directoryCoach(c, now));
  const sessions = await bookableGroupSessions(getDb(), now, 6);
  const areas = AREAS.filter((a) => coaches.some((c) => c.area === a.id)).map((a) => ({
    id: a.id,
    name: a.name,
  }));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:max-w-6xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Find a coach</h1>
        <p className="mt-2 max-w-2xl text-muted md:text-lg">
          Golf pros around Perth. See who&apos;s teaching this week and next, what they charge, and
          message them to book a lesson.
        </p>
        {coaches.length === 0 ? (
          <p className="mt-8 rounded-xl border border-border p-4 text-muted">
            No coaches yet. Check back soon.
          </p>
        ) : (
          <CoachDirectory coaches={coaches} areas={areas} />
        )}
        {sessions.length > 0 && (
          <section aria-labelledby="sessions" className="mt-10 max-w-3xl">
            <h2 id="sessions" className="text-xl font-semibold">
              Group sessions coming up
            </h2>
            <p className="mt-1 text-sm text-muted">
              Clinics and squads with spots left. Book a spot, or a few for friends or family.
            </p>
            <GroupSessionList sessions={sessions} />
          </section>
        )}
        <div className="mt-12 rounded-xl bg-surface p-5 md:flex md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="font-semibold">Are you a golf coach?</h2>
            <p className="mt-1 text-sm text-muted">
              List your lessons free. Golfers message you directly to book.
            </p>
          </div>
          <Link
            href="/coaching"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline md:mt-0"
          >
            List your coaching
          </Link>
        </div>
      </main>
    </>
  );
}
