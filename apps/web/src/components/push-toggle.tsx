"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pushState, turnOffPush, turnOnPush, type PushState } from "@/lib/push-client";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold";

/**
 * Turn push notifications on or off for this device. Explains instead when
 * the device can't do it yet, such as an iPhone before BookOn is on the Home Screen.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  async function change(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(on ? await turnOnPush(publicKey!) : await turnOffPush());
      router.refresh();
    } catch (e) {
      console.error(e);
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return <p className="text-sm text-muted">Checking this device…</p>;
  if (!publicKey || state === "unsupported") {
    return (
      <p className="text-sm text-muted">
        This browser can&apos;t show notifications. Email alerts still work.
      </p>
    );
  }
  if (state === "needs-install") {
    return (
      <p className="text-sm text-muted">
        On iPhone and iPad, add BookOn to your Home Screen first: tap the Share button, then{" "}
        <strong>Add to Home Screen</strong>. Open BookOn from there and turn notifications on.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="text-sm text-muted">
        Notifications are blocked for BookOn on this device. Allow them in your browser or phone
        settings, then come back here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" role="status">
        {state === "on"
          ? "Notifications are on for this device."
          : "Get alerts on this device the moment a time opens up."}
      </p>
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => change(state !== "on")}
          className={`${button} ${state === "on" ? "border border-border" : "bg-brand text-brand-foreground"} disabled:opacity-60`}
        >
          {busy
            ? "One moment…"
            : state === "on"
              ? "Turn off on this device"
              : "Turn on notifications"}
        </button>
      </div>
      {error && <p className="text-sm text-warning-fg">{error}</p>}
    </div>
  );
}
