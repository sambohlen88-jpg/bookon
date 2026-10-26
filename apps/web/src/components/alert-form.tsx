"use client";

/**
 * Add or edit an alert (Milestone 28): the day, time, players and holes, and
 * where: courses near the golfer (their phone's location, rounded to about a
 * kilometre, and a distance) or courses they pick.
 */
import Link from "next/link";
import { useActionState, useState } from "react";
import { NEAR_DISTANCES_KM, distanceKm } from "@bookon/core/areas";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import type { AlertFormValues } from "@/lib/alert-form";

export interface AlertFormCourse {
  slug: string;
  name: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AlertFormOptions {
  times: { value: string; label: string }[];
  days: { value: number; label: string }[];
  minDate: string;
  maxDate: string;
}

type Action = (state: { problems: string[] }, form: FormData) => Promise<{ problems: string[] }>;

const fieldLabel = "mb-1.5 block text-sm font-medium";
const control =
  "w-full min-h-12 rounded-lg border border-border bg-background px-3 text-base text-foreground";
const choice =
  "flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-base font-medium has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-brand-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand";

export function AlertForm({
  action,
  values,
  courses,
  options,
  alertId,
  submitLabel,
}: {
  action: Action;
  values: AlertFormValues;
  courses: AlertFormCourse[];
  options: AlertFormOptions;
  alertId?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { problems: [] });
  const [where, setWhere] = useState(values.where);
  const [within, setWithin] = useState<number>(values.within);
  const [here, setHere] = useState(
    values.latitude !== null && values.longitude !== null
      ? { latitude: values.latitude, longitude: values.longitude }
      : null,
  );
  const [locating, setLocating] = useState<"idle" | "finding" | "failed">("idle");

  function locate() {
    if (!("geolocation" in navigator)) return setLocating("failed");
    setLocating("finding");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Rounded to about a kilometre before it leaves the phone.
        setHere({
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { maximumAge: 10 * 60 * 1000, timeout: 15_000 },
    );
  }

  const located = courses.filter((c) => c.latitude !== null && c.longitude !== null);
  const away = (c: AlertFormCourse) =>
    here && c.latitude !== null && c.longitude !== null
      ? distanceKm(here, { latitude: c.latitude, longitude: c.longitude })
      : null;
  const inReach = here
    ? located
        .map((c) => ({ ...c, km: away(c)! }))
        .filter((c) => c.km <= within)
        .sort((a, b) => a.km - b.km)
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {alertId && <input type="hidden" name="alertId" value={alertId} />}
      {state.problems.length > 0 && <Notice tone="warning">{state.problems.join(" ")}</Notice>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="alert-date" className={fieldLabel}>
            Day
          </label>
          <input
            id="alert-date"
            name="date"
            type="date"
            required
            defaultValue={values.date}
            min={options.minDate}
            max={options.maxDate}
            className={control}
          />
        </div>
        <div>
          <label htmlFor="alert-days" className={fieldLabel}>
            Flexible?
          </label>
          <select id="alert-days" name="days" defaultValue={values.days} className={control}>
            {options.days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="alert-from" className={fieldLabel}>
            Earliest
          </label>
          <select id="alert-from" name="from" defaultValue={values.from} className={control}>
            {options.times.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="alert-to" className={fieldLabel}>
            Latest
          </label>
          <select id="alert-to" name="to" defaultValue={values.to} className={control}>
            {options.times.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={fieldLabel}>Players</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <label key={n} className={choice}>
              <input
                type="radio"
                name="players"
                value={n}
                defaultChecked={values.players === n}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>Holes</legend>
        <div className="flex gap-2">
          {(
            [
              ["any", "Either"],
              ["9", "9"],
              ["18", "18"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={choice}>
              <input
                type="radio"
                name="holes"
                value={value}
                defaultChecked={values.holes === value}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={fieldLabel}>Where</legend>
        <div className="flex gap-2">
          <label className={choice}>
            <input
              type="radio"
              name="where"
              value="near"
              checked={where === "near"}
              onChange={() => setWhere("near")}
              className="sr-only"
            />
            Courses near me
          </label>
          <label className={choice}>
            <input
              type="radio"
              name="where"
              value="courses"
              checked={where === "courses"}
              onChange={() => setWhere("courses")}
              className="sr-only"
            />
            Pick courses
          </label>
        </div>

        {where === "near" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={locate}
                className={here ? secondaryButton : primaryButton}
              >
                <span aria-hidden className="mr-2">
                  📍
                </span>
                {locating === "finding"
                  ? "Finding you…"
                  : here
                    ? "Update my location"
                    : "Use my location"}
              </button>
              {here && <span className="text-sm font-medium text-brand">Location set</span>}
            </div>
            {here && (
              <>
                <input type="hidden" name="lat" value={here.latitude} />
                <input type="hidden" name="lon" value={here.longitude} />
              </>
            )}
            {locating === "failed" && (
              <p role="alert" className="text-sm text-warning-fg">
                We couldn&apos;t get your location. Check location is allowed for BookOn in your
                phone&apos;s settings, or pick courses instead.
              </p>
            )}
            <div>
              <label htmlFor="alert-within" className={fieldLabel}>
                How far will you travel?
              </label>
              <select
                id="alert-within"
                name="within"
                value={within}
                onChange={(e) => setWithin(Number(e.target.value))}
                className={control}
              >
                {NEAR_DISTANCES_KM.map((km) => (
                  <option key={km} value={km}>
                    Within {km} km
                  </option>
                ))}
              </select>
            </div>
            {here ? (
              <p className="text-sm text-muted" aria-live="polite">
                {inReach.length === 0
                  ? "No courses that close yet. Try a bigger distance."
                  : `${inReach.length} ${inReach.length === 1 ? "course" : "courses"} within ${within} km: ${inReach.map((c) => c.name).join(", ")}.`}
              </p>
            ) : (
              <p className="text-sm text-muted">
                We&apos;ll keep your location with this alert, rounded to about a kilometre, to know
                which courses are close. It&apos;s deleted with the alert.
              </p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col rounded-xl border border-border">
            {[...courses]
              .sort((a, b) => (away(a) ?? 0) - (away(b) ?? 0) || a.name.localeCompare(b.name))
              .map((c) => (
                <li key={c.slug} className="border-t border-border first:border-t-0">
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      name="course"
                      value={c.slug}
                      defaultChecked={values.courses.includes(c.slug)}
                      className="size-5 shrink-0 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-sm text-muted">
                        {c.suburb}
                        {away(c) !== null ? ` · ${Math.round(away(c)!)} km` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        )}
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href="/account?tab=alerts" className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
