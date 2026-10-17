"use client";

import { useEffect, useRef, useState } from "react";
import { isIos, isStandalone } from "@/lib/push-client";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "bookon-install-dismissed-at";
const VISITS_KEY = "bookon-visits";
const VISIT_COUNTED_KEY = "bookon-visit-counted";
/** After "Not now", stay quiet for a month. */
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Counts browser sessions, so the banner waits for a golfer's second visit. */
function countVisit(): number {
  const local = storage("local");
  const session = storage("session");
  let visits = Number(local?.getItem(VISITS_KEY) ?? 0) || 0;
  if (session && !session.getItem(VISIT_COUNTED_KEY)) {
    visits++;
    try {
      session.setItem(VISIT_COUNTED_KEY, "1");
      local?.setItem(VISITS_KEY, String(visits));
    } catch {
      // Private browsing: just don't count.
    }
  }
  return visits;
}

function quiet(): boolean {
  const at = Number(storage("local")?.getItem(DISMISSED_KEY) ?? 0);
  return Date.now() - at < QUIET_MS;
}

/**
 * Suggest adding BookOn to the home screen, never on a golfer's first visit:
 * after they set an alert, or when they come back. Android and desktop
 * Chrome get an Add button; iPhone gets the two steps, as Apple has no button.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"button" | "ios" | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || quiet()) return;
    const visits = countVisit();
    const eligible =
      visits >= 2 || new URLSearchParams(window.location.search).get("alert") === "created";
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as BeforeInstallPromptEvent;
      if (eligible) setMode("button");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Only Safari can add to the iPhone home screen.
    const safari =
      /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    if (eligible && isIos() && safari) setMode("ios");
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      storage("local")?.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Nothing to remember it in; it may show again next time.
    }
    setMode(null);
  }

  async function install() {
    const event = deferred.current;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred.current = null;
    if (outcome === "dismissed") dismiss();
    else setMode(null);
  }

  if (!mode) return null;
  return (
    <div className="mx-auto max-w-md px-4">
      <aside
        aria-label="Add BookOn to your home screen"
        className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Add BookOn to your home screen</p>
          <p className="text-sm text-muted">
            {mode === "ios" ? (
              <>
                Tap the Share button, then <strong>Add to Home Screen</strong>. It opens like an app
                and can send you tee time alerts.
              </>
            ) : (
              "It opens like an app and can send you tee time alerts."
            )}
          </p>
          <div className="mt-2 flex gap-2">
            {mode === "button" && (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground"
              >
                Add
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium"
            >
              {mode === "ios" ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
