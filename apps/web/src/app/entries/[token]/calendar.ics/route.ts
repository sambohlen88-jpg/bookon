import { icsCalendar } from "@bookon/core";
import { entryByToken, listedEvent } from "@bookon/db";
import { eventCalendarEvent } from "@bookon/email";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The golfer's event, at their start time once the start sheet is out (Milestone 21). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const entry = await entryByToken(db, token);
  if (!entry) return new Response("Not found", { status: 404 });
  const event = await listedEvent(db, entry.eventId, new Date());
  if (entry.status !== "paid" || !event || event.status !== "open")
    return new Response("This entry isn't going ahead, so there's nothing to add.", {
      status: 410,
    });
  const body = icsCalendar({
    name: "Golf event",
    now: new Date(),
    events: [
      eventCalendarEvent(
        event,
        entry,
        { clubName: event.clubName, courseName: event.courseName },
        `${await siteOrigin()}/entries/${token}`,
      ),
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="golf-event.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}
