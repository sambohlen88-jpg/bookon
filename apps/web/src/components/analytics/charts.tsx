import type { SeriesPoint } from "@bookon/db";
import { bucketLabel, formatCount } from "@/lib/analytics-view";

/**
 * Charts for Admin, Analytics (Milestone 23), drawn on the server as SVG or
 * plain HTML. Colours come from the --chart and --heat tokens; every chart
 * has a table view for screen readers and exact numbers, and a tooltip on
 * hover.
 */

export function Change({
  change,
  lowerIsBetter = false,
}: {
  change: number | null;
  lowerIsBetter?: boolean;
}) {
  if (change === null) return <span className="text-sm text-muted">new</span>;
  if (change === 0) return <span className="text-sm text-muted">no change</span>;
  const up = change > 0;
  const good = up !== lowerIsBetter;
  return (
    <span className="text-sm text-muted">
      <span aria-hidden className={good ? "text-status-good" : "text-status-poor"}>
        {up ? "▲" : "▼"}
      </span>{" "}
      {Math.abs(change)}% {up ? "up" : "down"}
    </span>
  );
}

/** A headline number with its change against the period before. */
export function StatTile({
  label,
  value,
  change,
  lowerIsBetter,
  hint,
}: {
  label: string;
  value: string;
  change?: number | null;
  lowerIsBetter?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4" title={hint}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {change !== undefined && <Change change={change} lowerIsBetter={lowerIsBetter} />}
    </div>
  );
}

/** A top for the scale that splits into four whole-number steps. */
function niceMax(max: number): number {
  const raw = Math.max(1, max / 4);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw && Number.isInteger(s)) ?? 10 * power;
  return step * 4;
}

const SERIES_STROKE = ["stroke-chart-1", "stroke-chart-2"] as const;
const SERIES_BORDER = ["border-chart-1", "border-chart-2"] as const;
const SWATCH_CLASS = ["bg-chart-1", "bg-chart-2"] as const;

/**
 * One or two counts over time, on one scale. The lines stretch to the
 * width available; the labels are ordinary text, so they stay readable on
 * a phone.
 */
export function LineChart({
  points,
  series,
  bucket,
  title,
}: {
  points: SeriesPoint[];
  series: { key: string; label: string }[];
  bucket: "hour" | "day" | "week";
  title: string;
}) {
  const max = niceMax(
    Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0))),
  );
  // Positions as percentages of the plot area.
  const x = (i: number) => (points.length <= 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => (1 - v / max) * 100;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const column = points.length > 1 ? 100 / (points.length - 1) : 100;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {series.length > 1 && (
          <span className="flex gap-4 text-sm text-muted">
            {series.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block h-0.5 w-4 rounded ${SWATCH_CLASS[i]}`} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="flex gap-2 pt-2" role="img" aria-label={title}>
        {/* The scale. */}
        <div className="relative h-48 w-9 shrink-0 text-right text-xs text-muted">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ top: `${y(t)}%` }}
            >
              {formatCount(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              {ticks.map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={100}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-border"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {series.map((s, si) => (
                <polyline
                  key={s.key}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={SERIES_STROKE[si]}
                  points={points.map((p, i) => `${x(i)},${y(p.values[s.key] ?? 0)}`).join(" ")}
                />
              ))}
            </svg>
            {points.length <= 31 &&
              series.map((s, si) =>
                points.map((p, i) => (
                  <span
                    key={`${s.key}-${p.key}`}
                    aria-hidden
                    className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background ${SERIES_BORDER[si]}`}
                    style={{ left: `${x(i)}%`, top: `${y(p.values[s.key] ?? 0)}%` }}
                  />
                )),
              )}
            {/* Hover targets: one column per point, wider than the marks. */}
            {points.map((p, i) => (
              <span
                key={p.key}
                className="absolute inset-y-0 -translate-x-1/2 hover:bg-foreground/5"
                style={{ left: `${x(i)}%`, width: `${column}%` }}
                title={`${bucketLabel(p.key, bucket)}\n${series.map((s) => `${s.label}: ${formatCount(p.values[s.key] ?? 0)}`).join("\n")}`}
              />
            ))}
          </div>
          {/* Dates along the bottom. */}
          <div className="relative mt-1 h-5 text-xs text-muted">
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <span
                  key={p.key}
                  className={`absolute whitespace-nowrap ${i === 0 ? "" : "-translate-x-1/2"}`}
                  style={{ left: `${x(i)}%` }}
                >
                  {bucketLabel(p.key, bucket, true)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <TableView
        caption={title}
        head={["When", ...series.map((s) => s.label)]}
        rows={points.map((p) => [
          bucketLabel(p.key, bucket),
          ...series.map((s) => formatCount(p.values[s.key] ?? 0)),
        ])}
      />
    </figure>
  );
}

/** The numbers behind a chart, folded away. */
export function TableView({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted">Show as a table</summary>
      <div className="mt-2 max-h-80 overflow-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`border-b border-border px-2 py-1 font-semibold ${i ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={`border-b border-border px-2 py-1 ${ci ? "text-right tabular-nums" : ""}`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface BarRow {
  label: string;
  detail?: string | null;
  value: number;
  /** Shown instead of the value, like "1,204 · 34%". */
  display?: string;
  href?: string;
}

/** Counts by category, longest first: one colour, the number beside each bar. */
export function BarList({
  rows,
  title,
  empty = "Nothing yet.",
  limit = 10,
}: {
  rows: BarRow[];
  title?: string;
  empty?: string;
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((r) => r.value));
  return (
    <div className="min-w-0">
      {title && <h3 className="mb-2 font-semibold">{title}</h3>}
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <li
              key={`${r.label}|${r.detail ?? ""}`}
              title={`${r.label}${r.detail ? ` (${r.detail})` : ""}: ${r.display ?? formatCount(r.value)}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {r.href ? (
                    <a href={r.href} className="text-brand">
                      {r.label}
                    </a>
                  ) : (
                    r.label
                  )}
                  {r.detail && <span className="text-muted"> · {r.detail}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{r.display ?? formatCount(r.value)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-surface">
                <div
                  className="h-2 rounded-full bg-chart-1"
                  style={{ width: `${Math.max(r.value > 0 ? 1 : 0, (r.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && (
        <p className="mt-2 text-sm text-muted">And {rows.length - limit} more.</p>
      )}
    </div>
  );
}

/** Steps people go through, with how many carried on from the step before. */
export function Funnel({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const before = i > 0 ? steps[i - 1]!.count : null;
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {i + 1}. {s.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong>{formatCount(s.count)}</strong>
                  {before !== null && (
                    <span className="text-muted">
                      {" "}
                      · {before ? `${Math.round((s.count / before) * 100)}% of step ${i}` : "–"}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 rounded-sm bg-surface">
                <div
                  className="h-3 rounded-sm bg-chart-1"
                  style={{ width: `${Math.max(s.count > 0 ? 1 : 0, (s.count / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

const HEAT = [
  "bg-[var(--heat-0)]",
  "bg-[var(--heat-1)]",
  "bg-[var(--heat-2)]",
  "bg-[var(--heat-3)]",
  "bg-[var(--heat-4)]",
  "bg-[var(--heat-5)]",
];

/** Searches by the weekday and hour of the tee time wanted. */
export function DayHourGrid({
  grid,
  title,
}: {
  grid: { dow: number; hour: number; count: number }[];
  title: string;
}) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 15 }, (_, i) => i + 5); // 5 am to 7 pm
  const count = (d: number, h: number) =>
    grid
      .filter(
        (g) => g.dow === d && (h === 5 ? g.hour <= 5 : h === 19 ? g.hour >= 19 : g.hour === h),
      )
      .reduce((s, g) => s + g.count, 0);
  const max = Math.max(1, ...grid.map((g) => g.count));
  const level = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const hourLabel = (h: number) => (h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 font-semibold">{title}</figcaption>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs" role="grid">
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} className="w-7 font-normal text-muted">
                  {h % 2 === 1 ? hourLabel(h) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d}>
                <th className="pr-2 text-left font-normal text-muted">{d}</th>
                {hours.map((h) => {
                  const n = count(di + 1, h);
                  return (
                    <td
                      key={h}
                      title={`${d}, ${h === 5 ? "5am or earlier" : h === 19 ? "7pm or later" : hourLabel(h)}: ${formatCount(n)} ${n === 1 ? "search" : "searches"}`}
                      className={`h-6 w-7 rounded-sm ${HEAT[level(n)]}`}
                    >
                      <span className="sr-only">{n}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        Fewer
        {HEAT.map((c) => (
          <span key={c} aria-hidden className={`inline-block h-3 w-4 rounded-sm ${c}`} />
        ))}
        More
      </p>
    </figure>
  );
}

/** A heat colour for a share from 0 to 1. Cells with text in them stop at level 3, so the text stays readable. */
export function heatClass(share: number, top = 3): string {
  return HEAT[share <= 0 ? 0 : Math.min(top, Math.ceil(share * top))]!;
}
