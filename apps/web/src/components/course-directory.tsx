"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
// Only the areas module: the rest of @bookon/core is server code.
import { distanceKm, formatDistance } from "@bookon/core/areas";
import { CourseArt } from "@/components/course-art";

export interface DirectoryCourse {
  slug: string;
  name: string;
  suburb: string;
  /** "18 holes", "Golf sim" or "Driving range". */
  detail: string;
  /** A golf sim or driving range, listed in its own group. */
  venue: boolean;
  area: string | null;
  areaName: string;
  latitude: number | null;
  longitude: number | null;
  photoId: string | null;
  /** "Next 7:20 am" or "Next tomorrow 6:00 am", or null when nothing's free. */
  next: string | null;
}

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";

/**
 * Every course, with a search box, area buttons and Near me. Near me uses
 * the phone's location in the browser only: it never leaves the phone.
 */
export function CourseDirectory({
  courses,
  areas,
}: {
  courses: DirectoryCourse[];
  areas: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [finding, setFinding] = useState<"idle" | "finding" | "failed">("idle");
  const located = courses.some((c) => c.latitude !== null);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    const list = courses
      .filter((c) => !area || c.area === area)
      .filter((c) => !words || `${c.name} ${c.suburb} ${c.areaName}`.toLowerCase().includes(words))
      .map((c) => ({
        ...c,
        km:
          here && c.latitude !== null && c.longitude !== null
            ? distanceKm(here, { latitude: c.latitude, longitude: c.longitude })
            : null,
      }));
    if (here) list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    return list;
  }, [courses, query, area, here]);

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

  // Grouped by area unless searching or sorting by distance. Sims and ranges come last.
  const grouped = !here && !query.trim();
  const groups = grouped
    ? [
        ...[...areas, { id: null, name: "Other" }].map((a) => ({
          ...a,
          courses: shown.filter((c) => !c.venue && c.area === a.id),
        })),
        { id: "venues", name: "Golf sims & driving ranges", courses: shown.filter((c) => c.venue) },
      ].filter((g) => g.courses.length > 0)
    : [{ id: "all", name: "", courses: shown }];
  const noun = courses.some((c) => c.venue) ? "places" : "courses";

  return (
    <div>
      <label htmlFor="course-search" className="sr-only">
        Search courses
      </label>
      <input
        id="course-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or suburb"
        className="mt-6 w-full min-h-12 rounded-lg border border-border bg-background px-3 text-base md:max-w-md"
      />
      <div
        role="group"
        aria-label="Areas"
        className="relative -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {located && (
          <button
            type="button"
            aria-pressed={here !== null}
            onClick={nearMe}
            className={`${chip} gap-2 ${here ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
          >
            <span aria-hidden>📍</span>
            {finding === "finding" ? "Finding you…" : "Near me"}
          </button>
        )}
        {[{ id: null, name: "All" }, ...areas].map((a) => (
          <button
            key={a.id ?? "all"}
            type="button"
            aria-pressed={area === a.id}
            onClick={() => setArea(a.id)}
            className={`${chip} ${area === a.id ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
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
        {shown.length === courses.length
          ? `${courses.length} ${noun}`
          : `${shown.length} of ${courses.length} ${noun}`}
        {here ? ", closest first" : ""}
      </p>

      {shown.length === 0 && (
        <p className="mt-6 text-muted">Nothing matches. Try another name or area.</p>
      )}

      {groups.map((g) => (
        <section key={g.id ?? "other"} aria-label={g.name || "Courses"} className="mt-6 md:mt-10">
          {g.name && <h2 className="text-xl font-semibold">{g.name}</h2>}
          <ul className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {g.courses.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/courses/${c.slug}`}
                  className="group flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-background md:block md:hover:shadow-lg"
                >
                  <CourseArt
                    slug={c.slug}
                    photoId={c.photoId}
                    className="h-20 w-24 shrink-0 md:aspect-video md:h-auto md:w-full"
                  />
                  <div className="min-w-0 py-2 pr-3 md:p-4">
                    <p className="font-semibold leading-tight group-hover:text-brand">{c.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {c.suburb} · {c.detail}
                      {c.km !== null ? ` · ${formatDistance(c.km)}` : ""}
                    </p>
                    <p
                      className={`mt-0.5 text-sm ${c.next ? "font-medium text-brand" : "text-muted"}`}
                    >
                      {c.next ?? "Nothing free today or tomorrow"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
