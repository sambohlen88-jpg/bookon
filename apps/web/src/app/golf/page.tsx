import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SEO_PAGES } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Golf in Perth: Tee Times, Sims & Lessons | BookOn",
  description:
    "Free tee times at Perth and WA public golf courses by area, plus twilight and 9-hole golf, golf simulators and golf lessons.",
  alternates: { canonical: "/golf" },
};

/** The way into BookOn's pages for each area and common search. */
export default function GolfInPerth() {
  const areas = SEO_PAGES.filter((p) => p.kind === "area");
  const topics = SEO_PAGES.filter((p) => p.kind !== "area");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:max-w-4xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Golf in Perth</h1>
        <p className="mt-3 max-w-2xl text-muted md:text-lg">
          Free tee times at every public course BookOn checks, by area, plus twilight and 9-hole
          golf, golf simulators and lessons.
        </p>
        {[
          { title: "By area", pages: areas },
          { title: "Ways to play", pages: topics },
        ].map((group) => (
          <section key={group.title} className="mt-10">
            <h2 className="text-xl font-semibold">{group.title}</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {group.pages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/golf/${p.slug}`}
                    className="block h-full rounded-xl border border-border p-4 hover:border-brand"
                  >
                    <span className="font-semibold">{p.h1}</span>
                    <span className="mt-1 block text-sm text-muted">{p.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
