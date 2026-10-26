import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { articleById, listEnabledCourses } from "@bookon/db";
import { deleteMyDraft, saveMyDraft } from "@/app/write/actions";
import { AuthorControls } from "@/app/write/author-controls";
import { Pill, panel } from "@/components/admin/ui";
import { ArticleEditor } from "@/components/news/editor";
import { SiteHeader } from "@/components/site-header";
import { Notice, secondaryButton } from "@/components/ui";
import { requireAuthor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { artChoices, articleState } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your article · BookOn", robots: { index: false } };

const DONE: Record<string, string> = {
  saved: "Saved as a draft.",
  sent: "Sent to BookOn. You'll get an email when it's approved, or if there's anything to change.",
};

export default async function WriteArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { user, author } = await requireAuthor(`/write/${id}`);
  if (!author) redirect(`/admin/news/${id}`);
  const db = getDb();
  const article = await articleById(db, id);
  if (!article || article.authorId !== user.id) notFound();
  const query = await searchParams;
  const state = articleState(article);
  const now = new Date();
  const published = article.status === "published";
  const courses = artChoices(await listEnabledCourses(db));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href="/write" className="text-sm font-medium text-brand">
          ← Your articles
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{article.title}</h1>
        <div className="mb-6 mt-3 flex flex-col gap-2">
          <div>
            <Pill tone={state.tone}>{state.label}</Pill>
          </div>
          {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {article.status === "draft" && article.reviewNote && (
            <Notice tone="warning">
              BookOn sent this back: &ldquo;{article.reviewNote}&rdquo;
            </Notice>
          )}
        </div>
        {published ? (
          <div className={panel}>
            <p>
              {article.publishAt! <= now
                ? "It's published. Thanks for writing it!"
                : "It's approved and scheduled to go live by itself."}{" "}
              To change it now, email BookOn at info@bookon.au.
            </p>
            {article.publishAt! <= now && (
              <Link
                href={`/news/${article.slug}`}
                className="mt-3 inline-block font-medium text-brand"
              >
                Read it on BookOn →
              </Link>
            )}
          </div>
        ) : (
          <>
            <form action={saveMyDraft}>
              <ArticleEditor
                courses={courses}
                writerName={author.name}
                article={{
                  id: article.id,
                  title: article.title,
                  summary: article.summary,
                  body: article.body,
                  category: article.category,
                  coverPhotoId: article.coverPhotoId,
                  coverArt: article.coverArt,
                  coverAlt: article.coverAlt,
                }}
              >
                <AuthorControls waiting={article.status === "review"} />
              </ArticleEditor>
            </form>
            <form action={deleteMyDraft} className={`${panel} mt-10 flex flex-col gap-3`}>
              <input type="hidden" name="articleId" value={article.id} />
              <h2 className="text-lg font-semibold">Delete</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" value="yes" className="size-5 accent-brand" />
                Yes, delete this article for good
              </label>
              <button type="submit" className={`${secondaryButton} self-start`}>
                Delete
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
