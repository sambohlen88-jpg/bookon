import { formatAuPhone, formatPerthTime, groupStart } from "@bookon/core";
import { entriesForEvent, eventById } from "@bookon/db";
import { clubAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { csvCell, csvResponse } from "@/lib/report";

/** An event's start sheet, one row per player, for the club's team (Milestone 21). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; eventId: string }> },
) {
  const { clubId, eventId } = await params;
  const access = await clubAccess(clubId);
  if (!access) return new Response("Not found", { status: 404 });
  const db = getDb();
  const event = await eventById(db, eventId);
  if (!event || event.clubId !== access.club.id) return new Response("Not found", { status: 404 });
  const entries = (await entriesForEvent(db, event.id))
    .filter((e) => e.startGroup !== null)
    .sort((a, b) => a.startGroup! - b.startGroup!);
  const header = ["Group", "Time", "Tee or hole", "Player", "Member number", "Contact mobile"];
  const lines = entries.flatMap((e) => {
    const start = groupStart(event, e.startGroup!);
    return e.players.map((p) =>
      [
        e.startGroup!,
        formatPerthTime(start.time),
        start.where,
        p.name,
        p.memberNumber ?? "",
        formatAuPhone(e.contactPhone),
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return csvResponse(
    [header.join(","), ...lines].join("\r\n") + "\r\n",
    `${access.club.slug}-${event.date}-start-sheet.csv`,
  );
}
