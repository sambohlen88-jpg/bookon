import { GolfLoader } from "@/components/golf-loader";
import { SiteHeader } from "@/components/site-header";

/** While a page loads: the header, and the logo loader if it takes more than a moment. */
export function PageLoading({ label }: { label: string; picture?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main
        aria-busy="true"
        aria-label={label}
        className="flex min-h-[60vh] items-center justify-center pb-12"
      >
        <GolfLoader label={label} />
      </main>
    </>
  );
}
