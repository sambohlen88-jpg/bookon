import Link from "next/link";
import { formatPerthDay, formatPrice, perthDate } from "@bookon/core";
import type { ListedComp } from "@bookon/db";

/** Open match play competitions (Milestone 22), for the Competitions and course pages. */
export function CompCards({ comps, now }: { comps: ListedComp[]; now: Date }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {comps.map((c) => {
        const taking =
          c.status === "entries" &&
          c.onlineEntry &&
          (!c.entriesClose || c.entriesClose > now) &&
          c.entered < c.maxEntries;
        return (
          <li key={c.id}>
            <Link
              href={`/matchplay/${c.id}`}
              className="block h-full rounded-xl border border-border p-4 hover:border-brand"
            >
              <p className="text-sm font-medium text-muted">{c.clubName}</p>
              <p className="mt-1 font-semibold text-brand">{c.title}</p>
              <p className="mt-1 text-sm">
                {c.teamSize === 2 ? "Pairs" : "Singles"} match play · {c.courseName}
              </p>
              <p className="mt-2 text-sm text-muted">
                {taking
                  ? `${c.feeCents > 0 ? `${formatPrice(c.feeCents)} a player` : "Free"} · ${c.entered} of ${c.maxEntries} entered${c.entriesClose ? ` · closes ${formatPerthDay(perthDate(c.entriesClose))}` : ""}`
                  : c.status === "playing"
                    ? "Being played: see the draw"
                    : "Entries closed"}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
