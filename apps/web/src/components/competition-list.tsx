"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Only the areas module: the rest of @bookon/core is server code.
import { distanceKm, formatDistance } from "@bookon/core/areas";

export interface ListedCompetition {
  id: string;
  title: string;
  clubName: string;
  courseName: string;
  suburb: string;
  area: string | null;
  /** Perth date, for the date filter. */
  date: string;
  /** "Sat 14 Nov, 7:00 am". */
  when: string;
  /** "Teams of 4, 18 holes". */
  format: string;
  /** "$45 a player". */
  fee: string;
  left: number;
  closed: boolean;
  latitude: number | null;
  longitude: number | null;
}

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";
const on = "border-brand bg-brand text-brand-foreground";

/** Open competitions (Milestone 21), with area, date and Near me filters, all in the browser. */
export function CompetitionList({
  events,
  areas,
  weekEnd,
  monthEnd,
}: {
  events: ListedCompetition[];
  areas: { id: string; name: string }[];
  /** The last Perth dates of "This week" and "Next 4 weeks". */
  weekEnd: string;
  monthEnd: string;
}) {
  const [area, setArea] = useState<string | null>(null);
  const [range, setRange] = useState<"all" | "week" | "month">("all");
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [finding, setFinding] = useState<"idle" | "finding" | "failed">("idle");

  const shown = useMemo(() => {
    const list = events
      .filter((e) => !area || e.area === area)
      .filter((e) => range === "all" || e.date <= (range === "week" ? weekEnd : monthEnd))
      .map((e) => ({
        ...e,
        km:
          here && e.latitude !== null && e.longitude !== null
            ? distanceKm(here, { latitude: e.latitude, longitude: e.longitude })
            : null,
      }));
    if (here) list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [events, area, range, here, weekEnd, monthEnd]);

  function nearMe() {
    if (here) return setHere(null);
    setFinding("finding");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setFinding("idle");
      },
      () => setFinding("failed"),
      { maximumAge: 10 * 60 * 1000, timeout: 15_000 },
    );
  }

  return (
    <div>
      <div
        role="group"
        aria-label="When"
        className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {(
          [
            ["all", "Any time"],
            ["week", "This week"],
            ["month", "Next 4 weeks"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={range === id}
            onClick={() => setRange(id)}
            className={`${chip} ${range === id ? on : "border-border"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Areas"
        className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        <button
          type="button"
          aria-pressed={here !== null}
          onClick={nearMe}
          className={`${chip} gap-2 ${here ? on : "border-border"}`}
        >
          <span aria-hidden>📍</span>
          {finding === "finding" ? "Finding you…" : "Near me"}
        </button>
        {[{ id: null, name: "All areas" }, ...areas].map((a) => (
          <button
            key={a.id ?? "all"}
            type="button"
            aria-pressed={area === a.id}
            onClick={() => setArea(a.id)}
            className={`${chip} ${area === a.id ? on : "border-border"}`}
          >
            {a.name}
          </button>
        ))}
      </div>
      {finding === "failed" && (
        <p role="alert" className="mt-2 text-sm text-warning-fg">
          We couldn&apos;t get your location. Check location is allowed for BookOn in your
          phone&apos;s settings.
        </p>
      )}
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {shown.length} {shown.length === 1 ? "competition" : "competitions"}
        {here ? ", closest first" : ""}
      </p>
      {shown.length === 0 ? (
        <p className="mt-6 text-muted">Nothing matches. Try another area or a longer time.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 md:grid md:grid-cols-2">
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                href={`/competitions/${e.id}`}
                className="flex h-full flex-col rounded-xl border border-border p-4 hover:border-brand"
              >
                <span className="text-sm text-muted">{e.when}</span>
                <span className="mt-0.5 text-lg font-semibold leading-tight">{e.title}</span>
                <span className="mt-1 text-sm">
                  {e.clubName} · {e.suburb}
                  {e.km !== null ? ` · ${formatDistance(e.km)}` : ""}
                </span>
                <span className="text-sm text-muted">
                  {e.format} · {e.fee}
                </span>
                <span
                  className={`mt-2 text-sm font-semibold ${e.closed || e.left === 0 ? "text-muted" : "text-brand"}`}
                >
                  {e.closed
                    ? "Entries closed"
                    : e.left === 0
                      ? "Full: join the waiting list"
                      : `${e.left} ${e.left === 1 ? "place" : "places"} left`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
