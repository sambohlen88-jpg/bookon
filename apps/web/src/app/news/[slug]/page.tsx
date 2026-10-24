import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  NEWS_CATEGORIES,
  formatPerthDay,
  perthDate,
  readingMinutes,
  type NewsCategory,
} from "@bookon/core";
import { authorFor, publishedArticle, publishedArticles, socialLinks } from "@bookon/db";
import { siteUrl } from "@bookon/email";
import { Follow } from "@/components/follow";
import { ArticleBody } from "@/components/news/article-body";
import { ArticleCard } from "@/components/news/article-card";
import { ShareLinks } from "@/components/news/share-links";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";
import { coverUrl } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const article = await publishedArticle(getDb(), (await params).slug, new Date());
  if (!article) return { title: "Not found · BookOn" };
  return {
    title: `${article.title} · BookOn News`,
    description: article.summary,
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      siteName: "BookOn",
      publishedTime: article.publishAt!.toISOString(),
      authors: [article.authorName],
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.summary },
  };
}

/** One news article (Milestone 24), with sharing, BookOn's socials and more news. */
export default async function NewsArticle({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const now = new Date();
  const article = await publishedArticle(db, (await params).slug, now);
  if (!article) notFound();
  const author = article.authorId ? await authorFor(db, article.authorId) : null;
  const more = (await publishedArticles(db, now, { limit: 3, exceptId: article.id })).articles;
  const social = await socialLinks(db).catch(() => ({}));
  const url = `${siteUrl()}/news/${article.slug}`;
  const cover = coverUrl(article);
  const category = article.category ? NEWS_CATEGORIES[article.category as NewsCategory] : null;
  const structured = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishAt!.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": article.authorId ? "Person" : "Organization", name: article.authorName },
    publisher: { "@type": "Organization", name: "BookOn", url: siteUrl() },
    mainEntityOfPage: url,
    ...(cover ? { image: `${siteUrl()}${cover}` } : {}),
  };

  return (
    <>
      <SiteHeader />
      <main className="pb-24">
        <article className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-12">
          <Link href="/news" className="text-sm font-medium text-brand">
            ← News
          </Link>
          <p className="mt-4 text-sm font-medium text-muted">
            {category && (
              <Link href={`/news?category=${article.category}`} className="text-brand">
                {category}
              </Link>
            )}
            {category && " · "}
            {formatPerthDay(perthDate(article.publishAt!))} · {readingMinutes(article.body)} min
            read
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 text-lg text-muted md:text-xl">{article.summary}</p>
          <p className="mt-4 text-sm">By {article.authorName}</p>
          {cover && (
            <figure className="mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={article.coverAlt ?? ""}
                className="w-full rounded-2xl bg-surface"
              />
            </figure>
          )}
          <div className="mt-8">
            <ArticleBody markdown={article.body} />
          </div>
          {author?.bio && (
            <aside className="mt-10 rounded-xl bg-surface p-4">
              <p className="font-semibold">About {author.name}</p>
              <p className="mt-1 text-muted">{author.bio}</p>
            </aside>
          )}
          <div className="mt-10 border-t border-border pt-6">
            <ShareLinks url={url} title={article.title} />
            <Follow links={social} tone="page" />
          </div>
        </article>
        {more.length > 0 && (
          <section
            aria-labelledby="more-news"
            className="mx-auto mt-16 max-w-md px-4 md:max-w-6xl md:px-6"
          >
            <h2 id="more-news" className="text-2xl font-bold tracking-tight">
              More news
            </h2>
            <ul className="mt-4 grid gap-6 md:grid-cols-3">
              {more.map((a) => (
                <li key={a.id}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <script
          type="application/ld+json"
          // Built from our own data; < is escaped so it can't close the script.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}
        />
      </main>
    </>
  );
}
