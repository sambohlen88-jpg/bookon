import Link from "next/link";
import { formatAgo } from "@bookon/core";
import { listCoursesForAdmin } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { PROBLEM_LABEL } from "@/lib/check-problems";
import { getDb } from "@/lib/db";

export default async function CoursesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { show = "all" } = await searchParams;
  const now = new Date();
  const all = await listCoursesForAdmin(getDb(), now);
  const courses = all.filter((c) =>
    show === "on" ? c.enabled : show === "off" ? !c.enabled : true,
  );
  const fresh = (d: Date | null) => d && now.getTime() - d.getTime() <= 90 * 60 * 1000;

  return (
    <>
      <PageTitle
        title="Courses"
        intro="Every course, whether it's on the site, and how its checks are going."
      />
      <nav aria-label="Filter" className="mb-4 flex gap-2">
        {[
          ["all", `All (${all.length})`],
          ["on", `On (${all.filter((c) => c.enabled).length})`],
          ["off", `Off (${all.filter((c) => !c.enabled).length})`],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/courses?show=${value}`}
            className={`rounded-full border px-3 py-1 text-sm ${show === value ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Course</th>
              <th className={thClass}>On site</th>
              <th className={thClass}>Booking system</th>
              <th className={thClass}>Last good check</th>
              <th className={thClass}>Problems (24 h)</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td className={tdClass}>
                  <Link
                    href={`/admin/courses/${c.slug}`}
                    className="font-medium text-brand underline"
                  >
                    {c.name}
                  </Link>
                  <span className="block text-muted">{c.suburb}</span>
                </td>
                <td className={tdClass}>
                  <Pill tone={c.enabled ? "good" : "muted"}>{c.enabled ? "On" : "Off"}</Pill>
                </td>
                <td className={tdClass}>{c.platform}</td>
                <td className={tdClass}>
                  {c.health.lastSuccessAt ? (
                    <span className={fresh(c.health.lastSuccessAt) ? "" : "text-warning-fg"}>
                      {formatAgo(c.health.lastSuccessAt, now)}
                    </span>
                  ) : (
                    <span className="text-muted">Never</span>
                  )}
                </td>
                <td className={tdClass}>
                  {c.health.problem ? (
                    <Pill tone="warn">{PROBLEM_LABEL[c.health.problem]}</Pill>
                  ) : null}
                  <span className="block text-muted">
                    {c.health.failures24h} of {c.health.runs24h} checks failed
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
