import { courseActivity, coursesForClub } from "@bookon/db";
import { ReportRange, ReportTable } from "@/components/admin/report";
import { PageTitle } from "@/components/admin/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { reportRange } from "@/lib/report";

export default async function ClubReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/reports`);
  const { from, to } = reportRange(await searchParams, new Date());
  const db = getDb();
  const ids = new Set((await coursesForClub(db, club.id)).map((c) => c.id));
  const rows = (await courseActivity(db, from, to)).filter((r) => ids.has(r.courseId));
  return (
    <>
      <PageTitle
        title="Reports"
        intro="How many golfers saw your times on BookOn and went to your booking page (Perth dates)."
      />
      <ReportRange
        from={from}
        to={to}
        csvHref={`/club/${club.id}/reports/csv?from=${from}&to=${to}`}
      />
      <ReportTable rows={rows} />
    </>
  );
}
