"use client";

import { useEffect } from "react";

/** Registers /sw.js, for the offline page and push notifications. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("[sw] could not register", error);
    });
  }, []);
  return null;
}
