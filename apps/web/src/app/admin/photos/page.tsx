import { listCoursesForAdmin, listPendingPhotos } from "@bookon/db";
import { approvePhoto, declinePhoto } from "@/app/admin/actions";
import { PageTitle } from "@/components/admin/ui";
import { fieldLabel } from "@/components/form";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const db = getDb();
  const photos = await listPendingPhotos(db);
  const courses = await listCoursesForAdmin(db, new Date());

  return (
    <>
      <PageTitle
        title="Photos"
        intro="Photos clubs have sent. Approved photos replace the drawing for that course across the site."
      />
      {error === "course" && (
        <div className="mb-4">
          <Notice tone="warning">Choose which course the photo shows.</Notice>
        </div>
      )}
      {photos.length === 0 && <p className="text-muted">No photos waiting.</p>}
      <ul className="grid gap-6 md:grid-cols-2">
        {photos.map((p) => {
          const clubCourses = p.clubId ? courses.filter((c) => c.clubId === p.clubId) : courses;
          return (
            <li key={p.id} className="overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/admin/photo/${p.id}`}
                alt={p.caption ?? ""}
                className="aspect-video w-full object-cover"
              />
              <div className="flex flex-col gap-3 p-4">
                <p className="text-sm">
                  <span className="font-semibold">
                    {p.clubName ?? p.fromListing ?? "Unknown club"}
                  </span>
                  {!p.clubId && <span className="text-muted"> (listing not approved yet)</span>}
                  <span className="block text-muted">
                    {p.caption ?? "No caption"}
                    {p.credit ? ` · photo by ${p.credit}` : ""} · {p.width}×{p.height} · rights
                    confirmed by {p.rightsConfirmedBy}
                  </span>
                </p>
                <form className="flex flex-col gap-3">
                  <input type="hidden" name="photoId" value={p.id} />
                  <div>
                    <label htmlFor={`course-${p.id}`} className={fieldLabel}>
                      Shows which course
                    </label>
                    <select
                      id={`course-${p.id}`}
                      name="courseId"
                      defaultValue={clubCourses.length === 1 ? clubCourses[0]!.id : ""}
                      className={textInput}
                    >
                      <option value="">Choose a course</option>
                      {clubCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button formAction={approvePhoto} className={primaryButton}>
                      Approve
                    </button>
                    <button formAction={declinePhoto} className={secondaryButton}>
                      Decline
                    </button>
                  </div>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
