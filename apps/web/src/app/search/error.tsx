"use client";

import Link from "next/link";

export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Search isn&apos;t working right now</h1>
      <p className="mt-2 text-muted">Sorry about that. Please try again in a minute.</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-12 rounded-lg bg-brand px-4 font-semibold text-brand-foreground"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-lg border border-border px-4 font-medium"
        >
          Back to search
        </Link>
      </div>
    </main>
  );
}
