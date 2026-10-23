import Link from "next/link";
import type { ListedCompetition } from "@/components/competition-list";

/** "Competitions coming up" on the home page (Milestone 21): the next few open events. */
export function CompetitionsStrip({
  events,
  wide = false,
}: {
  events: ListedCompetition[];
  /** The desktop home page. */
  wide?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="competitions-strip" className={wide ? "" : "mt-10"}>
      <div className="flex items-end justify-between gap-4">
        <h2
          id="competitions-strip"
          className={wide ? "text-3xl font-bold tracking-tight" : "text-lg font-semibold"}
        >
          Competitions coming up
        </h2>
        <Link href="/competitions" className="shrink-0 text-sm font-semibold text-brand">
          See all
        </Link>
      </div>
      <ul className={`mt-4 grid gap-3 ${wide ? "grid-cols-3 gap-6" : ""}`}>
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/competitions/${e.id}`}
              className="flex h-full flex-col rounded-xl border border-border bg-background p-4 hover:border-brand"
            >
              <span className="text-sm text-muted">{e.when}</span>
              <span className="mt-0.5 font-semibold leading-tight">{e.title}</span>
              <span className="mt-1 text-sm text-muted">
                {e.clubName} · {e.format}
              </span>
              <span className="mt-2 text-sm font-semibold text-brand">
                {e.left === 0 ? "Full" : `${e.left} ${e.left === 1 ? "place" : "places"} left`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
