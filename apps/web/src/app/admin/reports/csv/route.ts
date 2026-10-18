import { courseActivity } from "@bookon/db";
import { isAdminRequest } from "@/lib/access";
import { getDb } from "@/lib/db";
import { activityCsv, csvResponse, reportRange } from "@/lib/report";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return new Response("Not found", { status: 404 });
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { from, to } = reportRange(query, new Date());
  const rows = await courseActivity(getDb(), from, to);
  return csvResponse(activityCsv(rows, from, to), `bookon-activity-${from}-to-${to}.csv`);
}
