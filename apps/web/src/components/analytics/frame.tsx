import Link from "next/link";
import { RANGE_LABEL, type AnalyticsRange, type RangePreset } from "@bookon/core";
import { PageTitle } from "@/components/admin/ui";
import { secondaryButton, textInput } from "@/components/ui";
import { ANALYTICS_TABS, rangeQuery } from "@/lib/analytics-view";

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";

/** The tabs, date range and download link at the top of each Analytics page. */
export function AnalyticsFrame({
  tab,
  range,
  csv,
  children,
}: {
  tab: (typeof ANALYTICS_TABS)[number]["slug"];
  range: AnalyticsRange;
  /** The report to download as CSV, if this tab has one. */
  csv?: string;
  children: React.ReactNode;
}) {
  const q = rangeQuery(range);
  const base = (slug: string) => `/admin/analytics${slug ? `/${slug}` : ""}`;
  return (
    <>
      <PageTitle
        title="Analytics"
        intro="How golfers use BookOn, from BookOn's own records. Your own visits, the portals and bots aren't counted. Perth time."
      />
      <nav
        aria-label="Analytics"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {ANALYTICS_TABS.map((t) => (
          <Link
            key={t.slug}
            href={`${base(t.slug)}${q}`}
            aria-current={t.slug === tab ? "page" : undefined}
            className={`${chip} ${t.slug === tab ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 flex flex-col gap-3 border-b border-border pb-4">
        <nav
          aria-label="Dates"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
        >
          {(["today", "7d", "30d", "90d", "12m"] as RangePreset[]).map((p) => (
            <Link
              key={p}
              href={`${base(tab)}?range=${p}`}
              aria-current={range.preset === p ? "true" : undefined}
              className={`${chip} min-h-9 px-3 ${range.preset === p ? "border-foreground font-semibold" : "border-border text-muted"}`}
            >
              {RANGE_LABEL[p]}
            </Link>
          ))}
        </nav>
        <form action={base(tab)} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="range" value="custom" />
          <label className="text-sm">
            <span className="block text-muted">From</span>
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              className={`${textInput} min-h-10 w-auto`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted">To</span>
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              className={`${textInput} min-h-10 w-auto`}
            />
          </label>
          <button type="submit" className={`${secondaryButton} min-h-10`}>
            Show
          </button>
          {csv && (
            <a
              href={`/admin/analytics/csv${q}&report=${csv}`}
              className={`${secondaryButton} min-h-10`}
            >
              Download CSV
            </a>
          )}
        </form>
      </div>
      <p className="mb-6 mt-3 text-sm text-muted">
        {range.from === range.to ? range.from : `${range.from} to ${range.to}`}, compared with{" "}
        {range.previous.from === range.previous.to
          ? range.previous.from
          : `${range.previous.from} to ${range.previous.to}`}
        .
      </p>
      {children}
    </>
  );
}

export function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-4">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
