import { icsCalendar } from "@bookon/core";
import { coachByCalendarToken, lessonById } from "@bookon/db";
import { lessonCalendarEvent } from "@bookon/email";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** One of the coach's lessons, to add to their calendar: /calendar/<token>/<lesson id>.ics. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string; lesson: string }> },
) {
  const { file, lesson: lessonFile } = await params;
  const db = getDb();
  const coach = await coachByCalendarToken(db, file);
  const lesson = coach ? await lessonById(db, lessonFile.replace(/\.ics$/, "")) : null;
  if (!coach || !lesson || lesson.coachId !== coach.id)
    return new Response("Not found", { status: 404 });
  if (lesson.status !== "confirmed" && lesson.status !== "requested")
    return new Response("This lesson isn't on any more.", { status: 410 });
  const body = icsCalendar({
    name: "BookOn lesson",
    now: new Date(),
    events: [
      lessonCalendarEvent(lesson, {
        for: "coach",
        coachName: coach.profile?.name ?? "Coach",
        url: `${await siteOrigin()}/coach/calendar`,
      }),
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bookon-lesson.ics"',
      "X-Robots-Tag": "noindex",
    },
  });
}
