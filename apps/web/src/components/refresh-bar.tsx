"use client";

import { useEffect, useState } from "react";

/** After this long on screen, results may well be out of date. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Tee sheets change by the minute. If results have been open a while, or the
 * golfer comes back to the tab or presses Back, offer a refresh. Never reloads
 * by itself, so nobody loses their place.
 */
export function RefreshBar({ renderedAt }: { renderedAt: string }) {
  const [minutesOld, setMinutesOld] = useState<number | null>(null);

  useEffect(() => {
    const rendered = Date.parse(renderedAt);
    const check = () => {
      const age = Date.now() - rendered;
      setMinutesOld(age >= STALE_AFTER_MS ? Math.floor(age / 60_000) : null);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Restored from the back/forward cache: the page may be hours old.
      if (event.persisted) check();
    };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", onPageShow);
    check();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [renderedAt]);

  if (minutesOld === null) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-0 border-t border-warning-border bg-warning-bg px-4 py-3 text-warning-fg"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <p className="text-sm">
          These times are {formatAge(minutesOld)} old. Tee times go fast, so check for the latest.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
