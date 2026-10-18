import Link from "next/link";
import { formatAgo } from "@bookon/core";
import { adminCounts, listCoursesForAdmin } from "@bookon/db";
import { PageTitle, panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { PROBLEM_LABEL } from "@/lib/check-problems";
import { getDb } from "@/lib/db";

export default async function AdminHome() {
  await requireAdmin();
  const db = getDb();
  const now = new Date();
  const counts = await adminCounts(db);
  const courses = await listCoursesForAdmin(db, now);
  const live = courses.filter((c) => c.enabled);
  const troubled = live.filter(
    (c) =>
      c.health.lastRunStatus === "error" ||
      !c.health.lastSuccessAt ||
      now.getTime() - c.health.lastSuccessAt.getTime() > 90 * 60 * 1000,
  );

  const cards = [
    { href: "/admin/listings", n: counts.listings, label: "join requests waiting" },
    { href: "/admin/photos", n: counts.photos, label: "photos to check" },
    { href: "/admin/clubs", n: counts.changeRequests, label: "booking page changes to check" },
    { href: "/admin/coaches", n: counts.coaches, label: "coach listings and photos to check" },
    { href: "/admin/courses", n: troubled.length, label: "live courses with check problems" },
  ];
  return (
    <>
      <PageTitle
        title="Admin"
        intro={`${live.length} courses live, ${courses.length - live.length} switched off.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={`${panel} block hover:border-brand`}>
            <span className={`block text-3xl font-bold ${c.n > 0 ? "text-brand" : "text-muted"}`}>
              {c.n}
            </span>
            <span className="text-sm text-muted">{c.label}</span>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Courses needing a look</h2>
        {troubled.length === 0 ? (
          <p className="mt-2 text-muted">Every live course was checked in the last 90 minutes.</p>
        ) : (
          <ul className="mt-3 rounded-xl border border-border">
            {troubled.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
              >
                <Link href={`/admin/courses/${c.slug}`} className="font-medium hover:text-brand">
                  {c.name}
                </Link>
                <span className="text-sm text-muted">
                  {c.health.problem ? PROBLEM_LABEL[c.health.problem] : "Not checked recently"}
                  {c.health.lastSuccessAt
                    ? ` · last good check ${formatAgo(c.health.lastSuccessAt, now)}`
                    : " · never checked"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">
          Courses are checked by the worker (<code>pnpm dev:worker</code> locally). If every course
          shows here, the worker probably isn&apos;t running.
        </p>
      </section>
    </>
  );
}
