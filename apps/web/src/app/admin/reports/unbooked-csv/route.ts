import { unbookedReport } from "@bookon/db";
import { isAdminRequest } from "@/lib/access";
import { getDb } from "@/lib/db";
import { csvResponse, reportRange, unbookedCsv } from "@/lib/report";

/** Unbooked tee times per course, for admins only. */
export async function GET(request: Request) {
  if (!(await isAdminRequest())) return new Response("Not found", { status: 404 });
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const now = new Date();
  const { from, to } = reportRange(query, now);
  const { rows } = await unbookedReport(getDb(), from, to, now);
  return csvResponse(unbookedCsv(rows, from, to), `bookon-unbooked-${from}-to-${to}.csv`);
}
