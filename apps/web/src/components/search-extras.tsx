"use client";

import { useEffect, useState } from "react";
import { WITHIN_OPTIONS, type Near } from "@/lib/near";

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";
const chipOff = "border-border text-foreground";
const chipOn = "border-brand bg-brand text-brand-foreground";

/** Today, Tomorrow, Sat, Sun: one tap sets the date field. Without JavaScript the date field still works. */
export function QuickDays({
  inputId,
  days,
  initial,
}: {
  inputId: string;
  days: { date: string; label: string }[];
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const sync = () => setValue(input?.value ?? "");
    input?.addEventListener("change", sync);
    return () => input?.removeEventListener("change", sync);
  }, [inputId]);
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="Quick days"
    >
      {days.map((d) => (
        <button
          key={d.date}
          type="button"
          aria-pressed={value === d.date}
          onClick={() => {
            const input = document.getElementById(inputId) as HTMLInputElement | null;
            if (input) input.value = d.date;
            setValue(d.date);
          }}
          className={`${chip} ${value === d.date ? chipOn : chipOff}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Near me: asks the phone for its location only when tapped, rounds it to
 * about a kilometre, and sends it with this search. Nothing is stored.
 */
export function NearMe({ initial }: { initial: Near | null }) {
  const [near, setNear] = useState<{ latitude: number; longitude: number } | null>(initial);
  const [within, setWithin] = useState<string>(initial?.within ? String(initial.within) : "");
  const [status, setStatus] = useState<"idle" | "finding" | "failed">("idle");
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported("geolocation" in navigator), []);
  if (!supported && !initial) return null;

  function find() {
    setStatus("finding");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNear({
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        });
        setStatus("idle");
      },
      () => setStatus("failed"),
      { maximumAge: 10 * 60 * 1000, timeout: 15_000 },
    );
  }

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">Distance</legend>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={near !== null}
          onClick={() => (near ? setNear(null) : find())}
          className={`${chip} gap-2 ${near ? chipOn : chipOff}`}
        >
          <span aria-hidden>📍</span>
          {status === "finding" ? "Finding you…" : "Near me"}
        </button>
        {near && (
          <>
            <input type="hidden" name="lat" value={near.latitude} />
            <input type="hidden" name="lon" value={near.longitude} />
            <label className="sr-only" htmlFor="within">
              How far
            </label>
            <select
              id="within"
              name="within"
              value={within}
              onChange={(e) => setWithin(e.target.value)}
              className="min-h-11 rounded-full border border-border bg-background px-3 text-sm"
            >
              <option value="">Any distance</option>
              {WITHIN_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {status === "failed" && (
        <p role="alert" className="mt-2 text-sm text-warning-fg">
          We couldn&apos;t get your location. Check location is allowed for BookOn in your
          phone&apos;s settings.
        </p>
      )}
      {near && (
        <p className="mt-2 text-xs text-muted">
          Closest courses first. Your location is only used for this search.
        </p>
      )}
    </fieldset>
  );
}

/**
 * Golf courses or Sims & ranges. CSS shows the fields for the one picked
 * (`.play-golf` and `.play-bays` in globals.css), so it works without
 * JavaScript. With it, Latest moves to the picked one's usual close.
 */
export function PlaySwitch({
  initial,
  toId,
  latest,
}: {
  initial: "golf" | "bays";
  /** The Latest field's id. */
  toId: string;
  /** Each choice's default Latest time. */
  latest: { golf: string; bays: string };
}) {
  function picked(play: "golf" | "bays") {
    const to = document.getElementById(toId) as HTMLSelectElement | null;
    const other = play === "golf" ? latest.bays : latest.golf;
    if (to && to.value === other) to.value = latest[play];
  }
  return (
    <fieldset>
      <legend className="sr-only">What are you booking?</legend>
      <div className="flex rounded-xl bg-surface p-1">
        {(
          [
            { value: "golf", label: "Golf courses" },
            { value: "bays", label: "Sims & ranges" },
          ] as const
        ).map((o) => (
          <label key={o.value} className="relative flex-1">
            <input
              type="radio"
              name="play"
              value={o.value}
              defaultChecked={initial === o.value}
              onChange={() => picked(o.value)}
              className="peer sr-only"
            />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-muted peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
