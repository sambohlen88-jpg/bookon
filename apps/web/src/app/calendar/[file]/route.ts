import { icsCalendar } from "@bookon/core";
import { coachByCalendarToken, coachCalendar, groupSessionsForCoach } from "@bookon/db";
import { groupCalendarEvent, lessonCalendarEvent } from "@bookon/email";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

/**
 * A coach's lessons as a calendar their calendar app subscribes to
 * (Milestone 16): /calendar/<private token>.ics. Booked lessons,
 * requests waiting for an answer marked as not confirmed, and group
 * sessions with who's coming (Milestone 19).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const coach = await coachByCalendarToken(getDb(), file.replace(/\.ics$/, ""));
  if (!coach) return new Response("Not found", { status: 404 });
  const now = new Date();
  const from = new Date(now.getTime() - 60 * DAY);
  const to = new Date(now.getTime() + 400 * DAY);
  const { lessons } = await coachCalendar(getDb(), coach.id, from, to);
  const sessions = await groupSessionsForCoach(getDb(), coach.id, now, { from, to });
  const site = await siteOrigin();
  const name = coach.profile?.name ?? coach.draft?.name ?? "Coach";
  const body = icsCalendar({
    name: "BookOn lessons",
    now,
    refreshMinutes: 30,
    events: [
      ...lessons.map((l) =>
        lessonCalendarEvent(l, { for: "coach", coachName: name, url: `${site}/coach/calendar` }),
      ),
      ...sessions
        .filter((s) => s.status === "open")
        .map((s) =>
          groupCalendarEvent(s, { for: "coach", bookings: s.bookings, url: `${site}/coach` }),
        ),
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bookon-lessons.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
