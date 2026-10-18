import { SiteHeader } from "@/components/site-header";

/** The shape of a page while it loads: a heading and a few rows. */
export function PageLoading({ label, picture = false }: { label: string; picture?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main aria-busy="true" aria-label={label} className="pb-12">
        {picture && <div className="h-44 animate-pulse bg-surface md:h-80" />}
        <div className="mx-auto max-w-md px-4 pt-6 md:max-w-6xl md:px-6">
          <div className="h-9 w-2/3 animate-pulse rounded bg-surface" />
          <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-surface" />
          <div className="mt-6 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
