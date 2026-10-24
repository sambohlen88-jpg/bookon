import type { Metadata } from "next";
import Link from "next/link";
import { NEWS_CATEGORIES, NEWS_PAGE_SIZE, isNewsCategory } from "@bookon/core";
import { publishedArticles, socialLinks } from "@bookon/db";
import { Follow } from "@/components/follow";
import { ArticleCard } from "@/components/news/article-card";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Golf news from Perth · BookOn",
  description: "Golf news, tips and what's on around Perth's public courses.",
  alternates: { types: { "application/rss+xml": "/news/rss.xml" } },
};

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";

/** BookOn News (Milestone 24): the latest article up top, then the rest, newest first. */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const category = isNewsCategory(query.category) ? query.category : null;
  const page = Math.max(1, Number(query.page) || 1);
  const db = getDb();
  const now = new Date();
  const { articles, total } = await publishedArticles(db, now, { category, page });
  const social = await socialLinks(db).catch(() => ({}));
  const pages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const [latest, ...rest] = page === 1 && !category ? articles : [null, ...articles];
  const href = (p: { category?: string | null; page?: number }) => {
    const q = new URLSearchParams();
    if (p.category) q.set("category", p.category);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    const s = q.toString();
    return `/news${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:max-w-6xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">News</h1>
        <p className="mt-2 max-w-2xl text-muted md:text-lg">
          Golf news, tips and what&apos;s on around Perth&apos;s public courses.
        </p>
        <nav
          aria-label="Categories"
          className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
        >
          <Link
            href="/news"
            aria-current={!category ? "page" : undefined}
            className={`${chip} ${!category ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
          >
            All
          </Link>
          {Object.entries(NEWS_CATEGORIES).map(([id, name]) => (
            <Link
              key={id}
              href={href({ category: id })}
              aria-current={category === id ? "page" : undefined}
              className={`${chip} ${category === id ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
            >
              {name}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <p className="mt-8 rounded-xl border border-border p-4 text-muted">
            {category ? "Nothing in this category yet." : "No news yet. Check back soon."}
          </p>
        ) : (
          <>
            {latest && (
              <div className="mt-8">
                <ArticleCard article={latest} feature />
              </div>
            )}
            {rest.length > 0 && (
              <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <li key={a!.id}>
                    <ArticleCard article={a!} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link href={href({ category, page: page - 1 })} className="font-semibold text-brand">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={href({ category, page: page + 1 })} className="font-semibold text-brand">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
        <Follow links={social} tone="page" />
      </main>
    </>
  );
}
