import Link from "next/link";
import {
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
  spotsLeftLabel,
} from "@bookon/core";
import type { SessionWithSpots } from "@bookon/db";

export interface ListedSession extends SessionWithSpots {
  coachSlug: string;
  /** Shown on lists across coaches. */
  coachName?: string;
}

/** Upcoming group sessions with spots left and a link to book (Milestone 19). */
export function GroupSessionList({ sessions }: { sessions: ListedSession[] }) {
  return (
    <ul className="mt-3 rounded-xl border border-border">
      {sessions.map((s) => (
        <li key={s.id} className="border-t border-border first:border-t-0">
          <Link
            href={`/coaches/${s.coachSlug}/sessions/${s.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="font-medium">{s.title}</span>
              <span className="block text-sm text-muted">
                {formatPerthDay(perthDate(s.startTime))}, {formatPerthTime(s.startTime)}
                {s.coachName ? ` · ${s.coachName}` : ""} · {s.place}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tabular-nums">{formatPrice(s.priceCents)}</span>
              <span
                className={`block text-sm ${s.left > 0 ? "font-medium text-brand" : "text-muted"}`}
              >
                {spotsLeftLabel(s.left)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
