import type { AnalyticsEventName } from "@bookon/core/analytics";

/**
 * Sending analytics from the browser (Milestone 23). Nothing is sent when
 * the browser asks not to be tracked (Do Not Track or Global Privacy Control).
 */

export function trackingAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== "1" && nav.globalPrivacyControl !== true;
}

/** Send and forget, even while the page is closing. */
export function beacon(body: Record<string, unknown>): void {
  if (!trackingAllowed()) return;
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/collect", new Blob([json], { type: "application/json" })))
      return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/collect", {
    method: "POST",
    body: json,
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

/** Count something a visitor did, like sharing a search. */
export function track(name: AnalyticsEventName, label: string | null = null): void {
  if (typeof window === "undefined") return;
  beacon({ type: "event", name, label, path: window.location.pathname });
}
