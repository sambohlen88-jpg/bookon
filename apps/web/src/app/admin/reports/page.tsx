import { courseActivity } from "@bookon/db";
import { ReportRange, ReportTable } from "@/components/admin/report";
import { PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { reportRange } from "@/lib/report";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { from, to } = reportRange(await searchParams, new Date());
  const rows = (await courseActivity(getDb(), from, to)).sort(
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions,
  );
  return (
    <>
      <PageTitle title="Reports" intro="What golfers did on BookOn, per course (Perth dates)." />
      <ReportRange from={from} to={to} csvHref={`/admin/reports/csv?from=${from}&to=${to}`} />
      <ReportTable rows={rows} />
    </>
  );
}
