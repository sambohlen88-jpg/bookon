import Link from "next/link";
import type { Article } from "@bookon/db";
import { ArticleCard } from "@/components/news/article-card";

/** "Latest news" on the home page (Milestone 24). */
export function NewsStrip({ articles, wide = false }: { articles: Article[]; wide?: boolean }) {
  if (articles.length === 0) return null;
  // The home page has a phone and a desktop version, so each needs its own id.
  const id = wide ? "news-strip-wide" : "news-strip";
  return (
    <section aria-labelledby={id} className={wide ? "" : "mt-10"}>
      <div className="flex items-end justify-between gap-4">
        <h2
          id={id}
          className={wide ? "text-3xl font-bold tracking-tight" : "text-lg font-semibold"}
        >
          Latest news
        </h2>
        <Link href="/news" className="shrink-0 text-sm font-semibold text-brand">
          All news
        </Link>
      </div>
      <ul className={`mt-4 grid gap-4 ${wide ? "grid-cols-3 gap-6" : ""}`}>
        {articles.map((a) => (
          <li key={a.id}>
            <ArticleCard article={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
