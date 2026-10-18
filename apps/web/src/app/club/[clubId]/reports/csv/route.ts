import { courseActivity, coursesForClub } from "@bookon/db";
import { clubAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { activityCsv, csvResponse, reportRange } from "@/lib/report";

/** A club's own activity report, for its signed-in team. */
export async function GET(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const access = await clubAccess((await params).clubId);
  if (!access) return new Response("Not found", { status: 404 });
  const db = getDb();
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { from, to } = reportRange(query, new Date());
  const ids = new Set((await coursesForClub(db, access.club.id)).map((c) => c.id));
  const rows = (await courseActivity(db, from, to)).filter((r) => ids.has(r.courseId));
  return csvResponse(
    activityCsv(rows, from, to),
    `${access.club.slug}-bookon-${from}-to-${to}.csv`,
  );
}
