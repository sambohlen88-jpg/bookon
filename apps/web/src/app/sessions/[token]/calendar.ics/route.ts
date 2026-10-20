import { icsCalendar } from "@bookon/core";
import { coachById, groupBookingByToken, groupSessionById } from "@bookon/db";
import { groupCalendarEvent } from "@bookon/email";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The golfer's group session, to add to their calendar (Milestone 19). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const booking = await groupBookingByToken(db, token);
  if (!booking) return new Response("Not found", { status: 404 });
  const session = await groupSessionById(db, booking.sessionId);
  if (booking.status !== "paid" || !session || session.status !== "open")
    return new Response("This booking isn't going ahead, so there's nothing to add.", {
      status: 410,
    });
  const coach = await coachById(db, session.coachId);
  const body = icsCalendar({
    name: "Golf session",
    now: new Date(),
    events: [
      groupCalendarEvent(session, {
        for: "golfer",
        coachName: coach?.profile?.name ?? "your coach",
        spots: booking.spots,
        url: `${await siteOrigin()}/sessions/${token}`,
      }),
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="golf-session.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}
