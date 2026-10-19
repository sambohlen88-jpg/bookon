import { icsCalendar } from "@bookon/core";
import { coachById, lessonByToken } from "@bookon/db";
import { lessonCalendarEvent } from "@bookon/email";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The golfer's booked lesson, to add to their calendar (Milestone 16). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const lesson = await lessonByToken(db, token);
  if (!lesson) return new Response("Not found", { status: 404 });
  if (lesson.status !== "confirmed")
    return new Response("This lesson isn't booked, so there's nothing to add.", { status: 410 });
  const coach = await coachById(db, lesson.coachId);
  const body = icsCalendar({
    name: "Golf lesson",
    now: new Date(),
    events: [
      lessonCalendarEvent(lesson, {
        for: "golfer",
        coachName: coach?.profile?.name ?? "your coach",
        url: `${await siteOrigin()}/lessons/${token}`,
      }),
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="golf-lesson.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}
