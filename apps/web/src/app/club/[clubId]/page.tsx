import Link from "next/link";
import { RATING_MIN_COUNT, addPerthDays, formatRating, perthDate, ratingCount } from "@bookon/core";
import { courseActivity, coursesForClub, listChangeRequests, ratingSummaries } from "@bookon/db";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { Notice } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ClubOverview({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}`);
  const db = getDb();
  const courses = await coursesForClub(db, club.id);
  const to = perthDate(new Date());
  const from = addPerthDays(to, -29);
  const ids = new Set(courses.map((c) => c.id));
  const activity = (await courseActivity(db, from, to)).filter((r) => ids.has(r.courseId));
  const sum = (key: "impressions" | "clicks" | "alertClicks" | "shareClicks") =>
    activity.reduce((n, r) => n + r[key], 0);
  const pending = await listChangeRequests(db, { status: "pending", clubId: club.id });
  const ratings = await ratingSummaries(db);

  return (
    <>
      <PageTitle title="Overview" intro="How your club is doing on BookOn." />
      {pending.length > 0 && (
        <div className="mb-4">
          <Notice tone="info">
            Your new booking page is waiting for BookOn to check it. We&apos;ll switch over once
            it&apos;s confirmed.
          </Notice>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [sum("impressions"), "times your course showed in search"],
          [sum("clicks"), "golfers sent to your booking page"],
          [sum("alertClicks"), "of those from alerts"],
          [sum("shareClicks"), "from times golfers shared"],
        ].map(([n, label]) => (
          <div key={label} className={panel}>
            <span className="block text-3xl font-bold text-brand">
              {Number(n).toLocaleString("en-AU")}
            </span>
            <span className="text-sm text-muted">{label}, last 30 days</span>
          </div>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your courses</h2>
        <ul className="mt-3 rounded-xl border border-border">
          {courses.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
            >
              <span>
                <span className="block font-medium">{c.name}</span>
                {c.enabled && (
                  <span className="block text-sm text-muted">
                    {(() => {
                      const r = ratings.get(c.id);
                      if (!r) return "No ratings from golfers yet";
                      if (r.count < RATING_MIN_COUNT)
                        return `${ratingCount(r.count)} so far: the average shows to golfers from ${RATING_MIN_COUNT}`;
                      return `Rated ${formatRating(r.average)} out of 5 by golfers, from ${ratingCount(r.count)}`;
                    })()}
                  </span>
                )}
              </span>
              {c.enabled ? (
                <span className="flex items-center gap-3 text-sm">
                  <Pill tone="good">Live</Pill>
                  <Link href={`/courses/${c.slug}`} className="text-brand underline">
                    See it on BookOn
                  </Link>
                </span>
              ) : (
                <Pill tone="muted">Being set up</Pill>
              )}
            </li>
          ))}
        </ul>
        {courses.some((c) => !c.enabled) && (
          <p className="mt-2 text-sm text-muted">
            Courses being set up go live once we&apos;ve connected to your booking page. We&apos;ll
            email you.
          </p>
        )}
      </section>
      <p className="mt-8 text-sm text-muted">
        Need to change a course&apos;s name or holes? Email info@bookon.au.
      </p>
    </>
  );
}
