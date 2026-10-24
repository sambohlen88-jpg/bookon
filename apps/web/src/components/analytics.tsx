"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { analyticsExcluded } from "@bookon/core/analytics";
import { beacon, trackingAllowed } from "@/lib/analytics-client";
import { urlEvents } from "@/lib/analytics-url";

function installedApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

/**
 * BookOn's own analytics (Milestone 23): a page view for each page, how long
 * it was on screen, actions in its address, and real loading times. Nothing
 * from the admin, club or coach portals, and nothing when the browser asks
 * not to be tracked.
 */
export function Analytics() {
  const pathname = usePathname();
  const params = useSearchParams();
  const page = useRef<{
    id: Promise<string | null> | null;
    shownMs: number;
    visibleSince: number | null;
  }>({ id: null, shownMs: 0, visibleSince: null });
  const last = useRef<{ path: string; params: URLSearchParams; url: string } | null>(null);

  useReportWebVitals((metric) => {
    if (!trackingAllowed() || analyticsExcluded(window.location.pathname)) return;
    beacon({
      type: "vital",
      name: metric.name,
      value: metric.value,
      path: window.location.pathname,
      width: window.innerWidth,
    });
  });

  // How long the current page has been on screen; sent when it's hidden or left.
  // Both only read refs, so they never change.
  const shown = useCallback(() => {
    const p = page.current;
    return p.shownMs + (p.visibleSince === null ? 0 : Date.now() - p.visibleSince);
  }, []);
  const sendTime = useCallback(() => {
    const ms = shown();
    page.current.id?.then((id) => id && beacon({ type: "leave", id, ms }));
  }, [shown]);

  useEffect(() => {
    const onVisibility = () => {
      const p = page.current;
      if (document.visibilityState === "hidden") {
        p.shownMs = shown();
        p.visibleSince = null;
        sendTime();
      } else p.visibleSince = Date.now();
    };
    // Leaving for another site or closing the tab doesn't always hide the page first.
    const onLeave = () => sendTime();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [shown, sendTime]);

  useEffect(() => {
    if (!trackingAllowed()) return;
    sendTime();
    const query = params.toString();
    const url = `${pathname}${query ? `?${query}` : ""}`;
    if (last.current?.url === url) return;
    if (analyticsExcluded(pathname)) {
      page.current = { id: null, shownMs: 0, visibleSince: null };
      last.current = null;
      return;
    }
    const referrer = last.current
      ? `${window.location.origin}${last.current.url}`
      : document.referrer || null;
    const id = fetch("/api/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "view",
        path: url,
        referrer,
        width: window.innerWidth,
        app: installedApp(),
      }),
    })
      .then((r) => (r.ok && r.status === 200 ? r.json() : null))
      .then((d: { id?: string } | null) => d?.id ?? null)
      .catch(() => null);
    page.current = {
      id,
      shownMs: 0,
      visibleSince: document.visibilityState === "visible" ? Date.now() : null,
    };
    for (const event of urlEvents(pathname, params, last.current))
      beacon({ type: "event", name: event.name, label: event.label, path: pathname });
    last.current = { path: pathname, params: new URLSearchParams(params), url };
  }, [pathname, params, sendTime]);

  return null;
}
