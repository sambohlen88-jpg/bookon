"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Only these modules: the rest of @bookon/core is server code.
import { distanceKm, formatDistance } from "@bookon/core/areas";
import { SPECIALITIES, specialityName } from "@bookon/core/coaching";
import { CoachAvatar, CoachBadges } from "@/components/coach-avatar";
import type { DirectoryCoach } from "@/lib/coaches";

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";
const on = "border-brand bg-brand text-brand-foreground";
const off = "border-border";

type When = "any" | "this" | "next";

/**
 * Every coach, with filters for when they teach, area, speciality and Near
 * me. Near me uses the phone's location in the browser only.
 */
export function CoachDirectory({
  coaches,
  areas,
}: {
  coaches: DirectoryCoach[];
  areas: { id: string; name: string }[];
}) {
  const [when, setWhen] = useState<When>("any");
  const [area, setArea] = useState<string | null>(null);
  const [speciality, setSpeciality] = useState("");
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [finding, setFinding] = useState<"idle" | "finding" | "failed">("idle");
  const located = coaches.some((c) => c.latitude !== null);

  const shown = useMemo(() => {
    const list = coaches
      .filter((c) => when === "any" || (when === "this" ? c.thisWeek : c.nextWeek).length > 0)
      .filter((c) => !area || c.area === area)
      .filter((c) => !speciality || c.specialities.includes(speciality))
      .map((c) => ({
        ...c,
        km:
          here && c.latitude !== null && c.longitude !== null
            ? distanceKm(here, { latitude: c.latitude, longitude: c.longitude })
            : null,
      }));
    // Closest first with Near me; otherwise those teaching this week first.
    if (here) list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    else list.sort((a, b) => Number(b.thisWeek.length > 0) - Number(a.thisWeek.length > 0));
    return list;
  }, [coaches, when, area, speciality, here]);

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
      <div role="group" aria-label="When" className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { id: "any", label: "Any time" },
            { id: "this", label: "This week" },
            { id: "next", label: "Next week" },
          ] as const
        ).map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={when === w.id}
            onClick={() => setWhen(w.id)}
            className={`${chip} ${when === w.id ? on : off}`}
          >
            {w.label}
          </button>
        ))}
        {located && (
          <button
            type="button"
            aria-pressed={here !== null}
            onClick={nearMe}
            className={`${chip} gap-2 ${here ? on : off}`}
          >
            <span aria-hidden>📍</span>
            {finding === "finding" ? "Finding you…" : "Near me"}
          </button>
        )}
      </div>
      <div
        role="group"
        aria-label="Areas"
        className="relative -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {[{ id: null, name: "All areas" }, ...areas].map((a) => (
          <button
            key={a.id ?? "all"}
            type="button"
            aria-pressed={area === a.id}
            onClick={() => setArea(a.id)}
            className={`${chip} ${area === a.id ? on : off}`}
          >
            {a.name}
          </button>
        ))}
      </div>
      <label htmlFor="speciality" className="sr-only">
        Speciality
      </label>
      <select
        id="speciality"
        value={speciality}
        onChange={(e) => setSpeciality(e.target.value)}
        className="mt-3 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base md:w-72"
      >
        <option value="">Any speciality</option>
        {SPECIALITIES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {finding === "failed" && (
        <p role="alert" className="mt-2 text-sm text-warning-fg">
          We couldn&apos;t get your location. Check location is allowed for BookOn in your
          phone&apos;s settings.
        </p>
      )}

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {shown.length === coaches.length
          ? `${coaches.length} ${coaches.length === 1 ? "coach" : "coaches"}`
          : `${shown.length} of ${coaches.length} coaches`}
        {here ? ", closest first" : ""}
      </p>
      {shown.length === 0 && (
        <p className="mt-6 text-muted">No coaches match. Try another week, area or speciality.</p>
      )}

      <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {shown.map((c) => {
          const days = when === "next" ? c.nextWeek : c.thisWeek;
          return (
            <li key={c.slug}>
              <Link
                href={`/coaches/${c.slug}`}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-4 md:hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <CoachAvatar name={c.name} photoId={c.photoId} />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-tight group-hover:text-brand">
                      {c.name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {c.suburb}
                      {c.km !== null ? ` · ${formatDistance(c.km)}` : ` · ${c.areaName}`}
                    </p>
                    <div className="mt-1.5">
                      <CoachBadges pgaVerified={c.pgaVerified} sample={c.sample} />
                    </div>
                  </div>
                </div>
                <p className="text-sm">{c.headline}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Specialities">
                  {c.specialities.slice(0, 4).map((s) => (
                    <li key={s} className="rounded-full bg-surface px-2.5 py-1 text-xs">
                      {specialityName(s)}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3 text-sm">
                  <span className={days.length > 0 ? "font-medium text-brand" : "text-muted"}>
                    {days.length > 0
                      ? `${when === "next" ? "Next week" : "This week"}: ${days.join(", ")}`
                      : when === "next"
                        ? "Not teaching next week"
                        : "Not teaching this week"}
                  </span>
                  {c.from && <span className="shrink-0 font-semibold">{c.from}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
