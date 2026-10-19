import { WEEKDAYS, formatPerthDay, perthDate } from "@bookon/core";
import { DAY_PARTS, type UnbookedReport } from "@bookon/db";
import { secondaryButton } from "@/components/ui";
import { panel, tableClass, tdClass, thClass } from "./ui";

const n = (value: number) => value.toLocaleString("en-AU");
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-AU")}`;
const percent = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

/** Unbooked tee times per course, with a headline for pitches. Admins only. */
export function UnbookedSection({
  report,
  from,
  to,
  csvHref,
}: {
  report: UnbookedReport;
  from: string;
  to: string;
  csvHref: string;
}) {
  const { rows, totals, since } = report;
  const withData = rows.filter((r) => r.unbooked > 0).length;
  const range =
    from === to ? formatPerthDay(from) : `${formatPerthDay(from)} to ${formatPerthDay(to)}`;
  const share = (count: number) => (totals.unbooked ? count / totals.unbooked : null);
  return (
    <section aria-labelledby="unbooked" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="unbooked" className="text-2xl font-bold tracking-tight">
            Unbooked tee times
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tee times still free in a check within the hour before they started. Golf courses only.
          </p>
        </div>
        <a href={csvHref} className={secondaryButton} download>
          Download CSV
        </a>
      </div>

      {!since ? (
        <p className="mt-4 text-muted">Not recording yet. It starts when the worker next runs.</p>
      ) : (
        <>
          <div className={`${panel} mt-4`}>
            <p className="text-lg">
              {range}: <strong>{n(totals.unbooked)} tee times</strong> ({n(totals.spots)} player
              spots
              {totals.valueCents > 0 ? `, about ${dollars(totals.valueCents)} in green fees` : ""})
              went unbooked across {withData} {withData === 1 ? "course" : "courses"}.
            </p>
            <p className="mt-2 text-sm text-muted">
              Recording since {formatPerthDay(perthDate(since))}. BookOn checked{" "}
              {percent(totals.coverage)} of the golfing day (6 am to 6:30 pm) in this range; times
              it didn&apos;t check aren&apos;t counted, so the real numbers are higher.
              {totals.unbooked > totals.priced
                ? ` Green fees are for the ${n(totals.priced)} tee times with a price on the club's page.`
                : ""}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Course</th>
                  <th className={`${thClass} text-right`}>Unbooked tee times</th>
                  <th className={`${thClass} text-right`}>Empty spots</th>
                  <th className={`${thClass} text-right`}>Green fees</th>
                  <th className={thClass}>Mostly</th>
                  <th className={`${thClass} text-right`}>Checked</th>
                  <th className={thClass}>
                    <span className="sr-only">Pitch report</span>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => {
                  const top = DAY_PARTS.reduce((best, p) =>
                    r.byPart[p.id] > r.byPart[best.id] ? p : best,
                  );
                  return (
                    <tr key={r.courseId}>
                      <td className={tdClass}>{r.name}</td>
                      <td className={`${tdClass} text-right`}>{n(r.unbooked)}</td>
                      <td className={`${tdClass} text-right`}>{n(r.spots)}</td>
                      <td className={`${tdClass} text-right`}>
                        {r.priced ? dollars(r.valueCents) : "—"}
                      </td>
                      <td className={tdClass}>
                        {r.unbooked
                          ? `${top.name} (${Math.round((r.byPart[top.id] / r.unbooked) * 100)}%)`
                          : "—"}
                      </td>
                      <td className={`${tdClass} text-right`}>{percent(r.coverage)}</td>
                      <td className={tdClass}>
                        <a
                          href={`/admin/reports/pitch?course=${r.slug}&from=${from}&to=${to}`}
                          className="font-medium whitespace-nowrap text-brand"
                        >
                          Pitch report
                        </a>
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td className={tdClass}>Total</td>
                  <td className={`${tdClass} text-right`}>{n(totals.unbooked)}</td>
                  <td className={`${tdClass} text-right`}>{n(totals.spots)}</td>
                  <td className={`${tdClass} text-right`}>{dollars(totals.valueCents)}</td>
                  <td className={tdClass} />
                  <td className={`${tdClass} text-right`}>{percent(totals.coverage)}</td>
                  <td className={tdClass} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Breakdown
              title="By day of the week"
              rows={WEEKDAYS.map((d, i) => ({
                label: d,
                count: totals.byWeekday[i]!,
                share: share(totals.byWeekday[i]!),
              }))}
            />
            <Breakdown
              title="By time of day"
              rows={DAY_PARTS.map((p) => ({
                label: p.name,
                count: totals.byPart[p.id],
                share: share(totals.byPart[p.id]),
              }))}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; share: number | null }[];
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <table className={`${tableClass} mt-2`}>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={tdClass}>{r.label}</td>
              <td className={`${tdClass} text-right`}>{n(r.count)}</td>
              <td className={`${tdClass} text-right text-muted`}>{percent(r.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
