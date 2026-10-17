import { SiteHeader } from "@/components/site-header";

/** Shown while results load: the shape of the page, without the data. */
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main
        className="mx-auto max-w-md px-4 pb-12 pt-4"
        aria-busy="true"
        aria-label="Loading tee times"
      >
        <div className="h-12 animate-pulse rounded-xl bg-surface" />
        <div className="mt-6 h-8 w-3/4 animate-pulse rounded bg-surface" />
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-surface" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="mt-4 h-10 animate-pulse rounded bg-surface" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
