import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAgo } from "@bookon/core";
import { cannotSwitchOn, listChangeLog, listCoursesForAdmin, listFetchRuns } from "@bookon/db";
import { saveCourse, toggleCourse } from "@/app/admin/actions";
import { PageTitle, Pill, panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Field, Select, TextArea } from "@/components/form";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { PROBLEM_LABEL } from "@/lib/check-problems";
import { getDb } from "@/lib/db";

export default async function CourseAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const { error, saved } = await searchParams;
  const db = getDb();
  const now = new Date();
  const course = (await listCoursesForAdmin(db, now)).find((c) => c.slug === slug);
  if (!course) notFound();
  const runs = await listFetchRuns(db, course.id, 10);
  const log = await listChangeLog(db, { courseId: course.id, limit: 20 });
  const blocked = cannotSwitchOn(course, Boolean(course.health.lastSuccessAt));
  const when = (d: Date) =>
    d.toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <>
      <PageTitle
        title={course.name}
        intro={
          <>
            {course.clubName} ·{" "}
            <Link href={`/admin/clubs/${course.clubId}`} className="underline">
              club
            </Link>{" "}
            ·{" "}
            <Link href={`/courses/${course.slug}`} className="underline">
              public page
            </Link>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <Notice tone="info">Saved.</Notice>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={panel} aria-labelledby="onsite">
          <h2 id="onsite" className="text-lg font-semibold">
            On the site
          </h2>
          <p className="mt-2">
            <Pill tone={course.enabled ? "good" : "muted"}>{course.enabled ? "On" : "Off"}</Pill>
          </p>
          {!course.enabled && blocked && <p className="mt-2 text-sm text-muted">{blocked}</p>}
          <form action={toggleCourse} className="mt-3">
            <input type="hidden" name="slug" value={course.slug} />
            <input type="hidden" name="on" value={course.enabled ? "0" : "1"} />
            <button
              type="submit"
              disabled={!course.enabled && Boolean(blocked)}
              className={`${course.enabled ? secondaryButton : primaryButton} disabled:opacity-50`}
            >
              {course.enabled ? "Switch off" : "Switch on"}
            </button>
          </form>
        </section>
        <section className={panel} aria-labelledby="health">
          <h2 id="health" className="text-lg font-semibold">
            Checks
          </h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Last good check</dt>
            <dd>
              {course.health.lastSuccessAt ? formatAgo(course.health.lastSuccessAt, now) : "Never"}
            </dd>
            <dt className="text-muted">Last check</dt>
            <dd>
              {course.health.lastRunAt ? formatAgo(course.health.lastRunAt, now) : "Never"}
              {course.health.lastRunStatus === "error" && course.health.problem && (
                <> · {PROBLEM_LABEL[course.health.problem]}</>
              )}
            </dd>
            <dt className="text-muted">Last 24 hours</dt>
            <dd>
              {course.health.failures24h} of {course.health.runs24h} checks failed
            </dd>
          </dl>
          {course.health.lastError && (
            <p className="mt-2 break-words text-xs text-muted">{course.health.lastError}</p>
          )}
          <p className="mt-3 text-xs text-muted">
            Test this course:{" "}
            <code>pnpm --filter @bookon/worker poll -- --course {course.slug} --days 2</code>
          </p>
        </section>
      </div>

      <form action={saveCourse} className={`${panel} mt-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">Details</h2>
        <input type="hidden" name="slug" value={course.slug} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" name="name" required defaultValue={course.name} />
          <Field label="Suburb" name="suburb" required defaultValue={course.suburb} />
          <Select
            label="Holes"
            name="holes"
            required
            options={{ "9": "9", "18": "18", "27": "27", "36": "36" }}
            defaultValue={String(course.holes)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Club website"
            name="websiteUrl"
            required
            inputMode="url"
            defaultValue={course.websiteUrl}
          />
          <Field
            label="Booking page"
            name="bookingUrl"
            required
            inputMode="url"
            defaultValue={course.bookingUrl}
            hint="Where Book sends golfers when there's no link for a particular time."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Days ahead times are released"
            name="bookingWindowDays"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={course.bookingWindowDays}
          />
          <Field
            label="Typical 18 hole fee ($)"
            name="typicalGreenFee"
            inputMode="decimal"
            defaultValue={
              course.typicalGreenFeeCents ? (course.typicalGreenFeeCents / 100).toFixed(2) : ""
            }
            hint="For club reports' estimated value."
          />
          <Select
            label="Booking system"
            name="platform"
            required
            options={{
              miclub: "MiClub",
              quick18: "Quick18",
              chronogolf: "Chronogolf",
              manual: "Other (can't be read)",
            }}
            defaultValue={course.platform}
          />
        </div>
        <TextArea
          label="Booking system settings (JSON)"
          name="platformConfig"
          rows={4}
          maxLength={4000}
          defaultValue={JSON.stringify(course.platformConfig, null, 2)}
          hint="What the reader needs, such as the MiClub address and booking resource id. Copy the shape from a working course of the same system."
        />
        <TextArea
          label="Notes"
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={course.notes}
        />
        <div>
          <button type="submit" className={primaryButton}>
            Save
          </button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent checks</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-muted">None yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Started</th>
                  <th className={thClass}>Result</th>
                  <th className={thClass}>Pages</th>
                  <th className={thClass}>Times found</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{when(r.startedAt)}</td>
                    <td className={tdClass}>
                      {r.status === "ok" ? (
                        "OK"
                      ) : r.status === "error" ? (
                        <span className="text-warning-fg">{r.error}</span>
                      ) : (
                        "Running"
                      )}
                    </td>
                    <td className={tdClass}>{r.requestCount}</td>
                    <td className={tdClass}>{r.teeTimeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Changes</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-muted">No changes recorded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {log.map((l) => (
              <li key={l.id}>
                <span className="text-muted">{when(l.at)}</span> · {l.action} · {l.actor}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
