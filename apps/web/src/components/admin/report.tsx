import type { CourseActivity } from "@bookon/db";
import { fieldLabel } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";
import { tableClass, tdClass, thClass } from "./ui";

/** Pick a date range for a report. A plain GET form, so the URL can be shared or bookmarked. */
export function ReportRange({ from, to, csvHref }: { from: string; to: string; csvHref: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="from" className={fieldLabel}>
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className={textInput} />
        </div>
        <div>
          <label htmlFor="to" className={fieldLabel}>
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className={textInput} />
        </div>
        <button type="submit" className={secondaryButton}>
          Show
        </button>
      </form>
      <a href={csvHref} className={secondaryButton} download>
        Download CSV
      </a>
    </div>
  );
}

/** Searches, times shown and clicks per course. */
export function ReportTable({ rows }: { rows: CourseActivity[] }) {
  const total = (key: keyof Omit<CourseActivity, "courseId" | "slug" | "name">) =>
    rows.reduce((n, r) => n + r[key], 0);
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Course</th>
            <th className={`${thClass} text-right`}>Searches</th>
            <th className={`${thClass} text-right`}>Times shown</th>
            <th className={`${thClass} text-right`}>Clicks to book</th>
            <th className={`${thClass} text-right`}>Golfers</th>
            <th className={`${thClass} text-right`}>From alerts</th>
            <th className={`${thClass} text-right`}>From shares</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.courseId}>
              <td className={tdClass}>{r.name}</td>
              <td className={`${tdClass} text-right`}>{r.searches.toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>{r.impressions.toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>{r.clicks.toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>{r.golfers.toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>{r.alertClicks.toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>{r.shareClicks.toLocaleString("en-AU")}</td>
            </tr>
          ))}
          {rows.length > 1 && (
            <tr className="font-semibold">
              <td className={tdClass}>Total</td>
              <td className={`${tdClass} text-right`}>—</td>
              <td className={`${tdClass} text-right`}>
                {total("impressions").toLocaleString("en-AU")}
              </td>
              <td className={`${tdClass} text-right`}>{total("clicks").toLocaleString("en-AU")}</td>
              <td className={`${tdClass} text-right`}>—</td>
              <td className={`${tdClass} text-right`}>
                {total("alertClicks").toLocaleString("en-AU")}
              </td>
              <td className={`${tdClass} text-right`}>
                {total("shareClicks").toLocaleString("en-AU")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        Searches count every search that included the course. Times shown counts each time a course
        appeared with at least one tee time. Golfers are counted per device, so the same golfer on
        two devices counts twice. Bots and link previews aren&apos;t counted.
      </p>
    </div>
  );
}
