"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Never leave a button waiting forever, say if the connection drops. */
const GIVE_UP_MS = 20_000;

function clearPending() {
  for (const el of document.querySelectorAll("[data-pending]")) {
    el.removeAttribute("data-pending");
    el.removeAttribute("aria-busy");
  }
  document.documentElement.removeAttribute("data-navigating");
}

/**
 * A link to another page on this site, opened in this tab. Checked before
 * Next's own link handling (which cancels the browser's), so not by
 * `defaultPrevented`.
 */
function internalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest("a");
  if (!link || link.target || link.hasAttribute("download")) return false;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return false;
  // Only a #jump on the same page isn't a load.
  return !(url.pathname === location.pathname && url.search === location.search);
}

/**
 * Milestone 18: when a form is sent, its button shows a rolling ball and a
 * second press is ignored, so nothing is booked or emailed twice. When a link
 * takes a moment, a thin line with a rolling ball shows along the top. Both
 * clear as soon as the next page shows.
 */
export function PendingForms() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.hasAttribute("data-pending")) {
        // Already sent: ignore the second press.
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (form.target === "_blank") return;
      const button =
        (event.submitter as HTMLElement | null) ??
        form.querySelector<HTMLElement>('button[type="submit"], button:not([type])');
      form.setAttribute("data-pending", "");
      button?.setAttribute("data-pending", "");
      button?.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        form.removeAttribute("data-pending");
        button?.removeAttribute("data-pending");
        button?.removeAttribute("aria-busy");
      }, GIVE_UP_MS);
    };
    const onClick = (event: MouseEvent) => {
      if (!internalNavigation(event)) return;
      document.documentElement.setAttribute("data-navigating", "");
      window.setTimeout(
        () => document.documentElement.removeAttribute("data-navigating"),
        GIVE_UP_MS,
      );
    };
    // Back to a page the browser kept in memory: nothing is waiting any more.
    const onPageShow = () => clearPending();
    // A form that saves and stays on the same page (the favourite star, say) never changes the
    // address, so also clear once the site has answered: Next sends form actions with this header.
    const originalFetch = window.fetch;
    let sending = 0;
    window.fetch = async (input, init) => {
      if (!new Headers(init?.headers).has("next-action")) return originalFetch(input, init);
      sending++;
      try {
        return await originalFetch(input, init);
      } finally {
        sending--;
        // A moment for the page to show the result first.
        if (sending === 0) window.setTimeout(clearPending, 300);
      }
    };
    // Capture: before React sees the submit, so a second press can be stopped.
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", onPageShow);
      window.fetch = originalFetch;
    };
  }, []);

  // The next page (or the same page with new choices) has shown.
  useEffect(() => {
    clearPending();
  }, [pathname, search]);

  return <div className="nav-progress" aria-hidden />;
}
