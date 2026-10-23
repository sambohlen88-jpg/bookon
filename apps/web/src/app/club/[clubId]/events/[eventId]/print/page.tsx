import Link from "next/link";
import { notFound } from "next/navigation";
import { TEAM_NAME, formatPerthDay, groupStartLabel, type TeamSize } from "@bookon/core";
import { entriesForEvent, listedEvent } from "@bookon/db";
import { eventPlace } from "@bookon/email";
import { PrintButton } from "@/components/print-button";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

/** The start sheet to print or save as a PDF (Milestone 21). */
export default async function PrintStartSheet({
  params,
}: {
  params: Promise<{ clubId: string; eventId: string }>;
}) {
  const { clubId, eventId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/events/${eventId}/print`);
  const db = getDb();
  const event = await listedEvent(db, eventId, new Date());
  if (!event || event.clubId !== club.id) notFound();
  const entries = (await entriesForEvent(db, event.id)).filter((e) => e.startGroup !== null);
  const groups = [...new Set(entries.map((e) => e.startGroup!))].sort((a, b) => a - b);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/club/${club.id}/events/${event.id}#start-sheet`}
          className="text-sm font-medium text-brand"
        >
          ← Back
        </Link>
        <PrintButton label="Print or save as PDF" />
      </div>
      <h1 className="text-2xl font-bold">{event.title}</h1>
      <p className="text-muted">
        {eventPlace({ clubName: club.name, courseName: event.courseName })} ·{" "}
        {formatPerthDay(event.date)} · {TEAM_NAME[event.teamSize as TeamSize]}, {event.holes} holes
      </p>
      {groups.length === 0 ? (
        <p className="mt-6">No start sheet yet.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border py-2 pr-4 text-left">Group</th>
              <th className="border-b border-border py-2 pr-4 text-left">Start</th>
              <th className="border-b border-border py-2 text-left">Players</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g} className="break-inside-avoid">
                <td className="border-b border-border py-2 pr-4 align-top tabular-nums">{g}</td>
                <td className="whitespace-nowrap border-b border-border py-2 pr-4 align-top">
                  {groupStartLabel(event, g)}
                </td>
                <td className="border-b border-border py-2 align-top">
                  {entries
                    .filter((e) => e.startGroup === g)
                    .map((e) => e.players.map((p) => p.name).join(", "))
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-6 text-xs text-muted">Entries through BookOn.</p>
    </div>
  );
}
