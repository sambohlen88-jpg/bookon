import { formatAuPhone, formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import { entriesForEvent, eventById } from "@bookon/db";
import { clubAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { csvCell, csvResponse } from "@/lib/report";

/** An event's entries, one row per player, for the club's team (Milestone 21). */
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
  const entries = await entriesForEvent(db, event.id);
  const header = [
    "Entry",
    "Player",
    "Member number",
    "Contact",
    "Mobile",
    "Email",
    "Note",
    "Entry fees ($)",
    "Entered",
    "Group",
  ];
  const lines = entries.flatMap((e, i) =>
    e.players.map((p) =>
      [
        i + 1,
        p.name,
        p.memberNumber ?? "",
        e.contactName,
        formatAuPhone(e.contactPhone),
        e.contactEmail,
        e.note ?? "",
        (e.feesCents / 100).toFixed(2),
        e.paidAt ? `${formatPerthDay(perthDate(e.paidAt))} ${formatPerthTime(e.paidAt)}` : "",
        e.startGroup ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  return csvResponse(
    [header.join(","), ...lines].join("\r\n") + "\r\n",
    `${access.club.slug}-${event.date}-entries.csv`,
  );
}
