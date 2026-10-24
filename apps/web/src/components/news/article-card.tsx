import Link from "next/link";
import { NEWS_CATEGORIES, formatPerthDay, perthDate, type NewsCategory } from "@bookon/core";
import type { Article } from "@bookon/db";
import { coverUrl } from "@/lib/news";

/** An article on the news page or home page (Milestone 24). */
export function ArticleCard({ article, feature = false }: { article: Article; feature?: boolean }) {
  const cover = coverUrl(article);
  const date = formatPerthDay(perthDate(article.publishAt!));
  const category = article.category ? NEWS_CATEGORIES[article.category as NewsCategory] : null;
  return (
    <Link
      href={`/news/${article.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background hover:border-brand ${feature ? "md:grid md:grid-cols-[3fr_2fr]" : ""}`}
    >
      <div
        className={`overflow-hidden bg-surface ${feature ? "aspect-[16/9] md:aspect-auto md:h-full" : "aspect-[16/9]"}`}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={article.coverAlt ?? ""}
            loading={feature ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        )}
      </div>
      <div className={`flex flex-1 flex-col p-4 ${feature ? "md:p-8" : ""}`}>
        <p className="text-sm text-muted">
          {feature && <span className="font-semibold text-brand">Latest · </span>}
          {category ? `${category} · ` : ""}
          {date}
        </p>
        <h3
          className={`mt-1 font-bold leading-tight tracking-tight ${feature ? "text-2xl md:text-4xl" : "text-lg"}`}
        >
          {article.title}
        </h3>
        <p className={`mt-2 text-muted ${feature ? "md:text-lg" : "line-clamp-3 text-sm"}`}>
          {article.summary}
        </p>
        {feature && <p className="mt-4 text-sm text-muted">By {article.authorName}</p>}
      </div>
    </Link>
  );
}
