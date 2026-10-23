import Link from "next/link";
import { TEAM_NAME, formatPerthDay, formatPerthTime, type TeamSize } from "@bookon/core";
import { eventsForClub } from "@bookon/db";
import { clubTakesEntries } from "@bookon/payments";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, primaryButton } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

/** A club's events (Milestone 21): what's coming up, entries so far, and putting on a new one. */
export default async function ClubEvents({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/events`);
  const ctx = await lessonContext();
  const now = ctx?.now ?? new Date();
  const ready = ctx ? await clubTakesEntries(ctx, club) : false;
  const events = await eventsForClub(getDb(), club.id, now);
  const upcoming = events.filter((e) => e.firstStart > now);
  const past = events.filter((e) => e.firstStart <= now).reverse();

  return (
    <>
      <PageTitle
        title="Events"
        intro="Competitions and social days golfers enter and pay for on BookOn. Nothing here uses handicaps."
      />
      {!ready ? (
        <div className="mb-6">
          <Notice tone="info">
            Set up payments first (the{" "}
            <Link href={`/club/${club.id}/payments`} className="underline">
              Payments
            </Link>{" "}
            tab), so golfers can pay to enter.
          </Notice>
        </div>
      ) : (
        <Link href={`/club/${club.id}/events/new`} className={`${primaryButton} mb-6`}>
          Put on an event
        </Link>
      )}
      {events.length === 0 ? (
        <p className="text-muted">No events yet.</p>
      ) : (
        [
          { title: "Coming up", list: upcoming },
          { title: "Earlier", list: past },
        ]
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <section key={g.title} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">{g.title}</h2>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Event</th>
                      <th className={thClass}>Day</th>
                      <th className={`${thClass} text-right`}>Entered</th>
                      <th className={thClass}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.list.map((e) => (
                      <tr key={e.id}>
                        <td className={tdClass}>
                          <Link
                            href={`/club/${club.id}/events/${e.id}`}
                            className="font-medium text-brand"
                          >
                            {e.title}
                          </Link>
                          <span className="block text-muted">
                            {TEAM_NAME[e.teamSize as TeamSize]} · {e.courseName}
                            {e.open ? "" : " · members only"}
                          </span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap`}>
                          {formatPerthDay(e.date)}, {formatPerthTime(e.firstStart)}
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>
                          {e.taken} of {e.maxPlayers}
                        </td>
                        <td className={tdClass}>
                          {e.status === "cancelled" ? (
                            <Pill tone="muted">Cancelled</Pill>
                          ) : e.firstStart <= now ? (
                            <Pill tone="muted">Played</Pill>
                          ) : e.entriesClose <= now ? (
                            <Pill tone="warn">
                              {e.startSheetPublishedAt ? "Start sheet out" : "Entries closed"}
                            </Pill>
                          ) : (
                            <Pill tone="good">Taking entries</Pill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
      )}
    </>
  );
}
