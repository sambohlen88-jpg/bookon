"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Searches are remembered on this device only, never sent to BookOn. */
const KEY = "bookon:recent-searches";
const MAX = 5;

interface Recent {
  href: string;
  label: string;
  /** The search's first day, so past searches can be dropped. */
  date: string;
}

function read(): Recent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? (parsed as Recent[]).filter((r) => r?.href?.startsWith("/search?"))
      : [];
  } catch {
    return [];
  }
}

/** Put on a search page: remembers this search for the home page. */
export function RememberSearch({ href, label, date }: Recent) {
  useEffect(() => {
    try {
      const rest = read().filter((r) => r.href !== href);
      localStorage.setItem(KEY, JSON.stringify([{ href, label, date }, ...rest].slice(0, MAX)));
    } catch {
      // Private browsing or storage switched off: nothing to remember.
    }
  }, [href, label, date]);
  return null;
}

/** The last few searches on this phone, one tap to run again. */
export function RecentSearches({ today }: { today: string }) {
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => setRecent(read().filter((r) => r.date >= today)), [today]);
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recent" className="mt-10">
      <div className="flex items-center justify-between">
        <h2 id="recent" className="text-lg font-semibold">
          Recent searches
        </h2>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {}
            setRecent([]);
          }}
          className="min-h-11 text-sm text-muted"
        >
          Clear
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {recent.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <span>{r.label}</span>
              <span aria-hidden className="text-brand">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
