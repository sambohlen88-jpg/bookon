import Link from "next/link";
import { RATING_MIN_COUNT, formatPerthDay, formatRating, perthDate } from "@bookon/core";
import { listCourseDetails, listRatingsForAdmin, ratingSummaries } from "@bookon/db";
import { removeRating } from "@/app/admin/rating-actions";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Course ratings (Milestone 20): each course's average, and every rating with who gave it. */
export default async function AdminRatings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const db = getDb();
  const query = await searchParams;
  const summaries = await ratingSummaries(db);
  const courses = (await listCourseDetails(db))
    .filter((c) => summaries.has(c.id))
    .map((c) => ({ ...c, rating: summaries.get(c.id)! }))
    .sort((a, b) => b.rating.count - a.rating.count || a.name.localeCompare(b.name));
  const ratings = await listRatingsForAdmin(db);

  return (
    <>
      <PageTitle
        title="Ratings"
        intro={`Golfers' star ratings of courses. Golfers see a course's average once it has ${RATING_MIN_COUNT} ratings. Remove one that looks like spam or a grudge; it's recorded in the change log.`}
      />
      {query.removed && (
        <div className="mb-4">
          <Notice tone="info">Removed. The course&apos;s average is updated.</Notice>
        </div>
      )}
      {query.gone && (
        <div className="mb-4">
          <Notice tone="info">That rating had already been removed.</Notice>
        </div>
      )}
      {courses.length === 0 ? (
        <p className="text-muted">No ratings yet.</p>
      ) : (
        <>
          <h2 className="mb-3 text-xl font-semibold">By course</h2>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Course</th>
                  <th className={`${thClass} text-right`}>Average</th>
                  <th className={`${thClass} text-right`}>Ratings</th>
                  <th className={thClass}>Shown to golfers</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className={tdClass}>
                      <Link href={`/courses/${c.slug}`} className="text-brand">
                        {c.name}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatRating(c.rating.average)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{c.rating.count}</td>
                    <td className={tdClass}>
                      {c.rating.count >= RATING_MIN_COUNT ? (
                        <Pill tone="good">Yes</Pill>
                      ) : (
                        <Pill tone="muted">Not yet</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 mt-10 text-xl font-semibold">Every rating, newest first</h2>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Course</th>
                  <th className={thClass}>Stars</th>
                  <th className={thClass}>Golfer</th>
                  <th className={thClass}>When</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {ratings.map((r) => (
                  <tr key={`${r.userId}-${r.courseId}`}>
                    <td className={tdClass}>{r.courseName}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className="text-star" aria-hidden>
                        {"★".repeat(r.stars)}
                      </span>
                      <span className="sr-only">{r.stars} out of 5</span>
                    </td>
                    <td className={tdClass}>{r.email}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatPerthDay(perthDate(r.updatedAt))}
                    </td>
                    <td className={tdClass}>
                      <form action={removeRating}>
                        <input type="hidden" name="userId" value={r.userId} />
                        <input type="hidden" name="courseId" value={r.courseId} />
                        <button type="submit" className={secondaryButton}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
