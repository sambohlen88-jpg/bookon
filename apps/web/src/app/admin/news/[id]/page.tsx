import Link from "next/link";
import { notFound } from "next/navigation";
import { articleById, listEnabledCourses } from "@bookon/db";
import { deleteNews, saveNewsDraft, sendNewsBack, unpublishNews } from "@/app/admin/news/actions";
import { PublishControls } from "@/app/admin/news/publish-controls";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { ArticleEditor } from "@/components/news/editor";
import { Notice, secondaryButton, textInput } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { artChoices, articleState, whenPerth } from "@/lib/news";

const DONE: Record<string, string> = {
  saved: "Saved.",
  published: "Published. It's on the news page now.",
  scheduled: "Scheduled. It goes live by itself at that time.",
  "sent-back": "Sent back to the author with your note.",
  unpublished: "Unpublished. It's a draft again, and off the news page.",
};

export default async function EditNewsArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/news/${id}`);
  const db = getDb();
  const article = await articleById(db, id);
  if (!article) notFound();
  const query = await searchParams;
  const courses = artChoices(await listEnabledCourses(db));
  const state = articleState(article);
  const now = new Date();
  const live = article.status === "published" && article.publishAt! <= now;
  const hidden = <input type="hidden" name="articleId" value={article.id} />;

  return (
    <>
      <Link href="/admin/news" className="text-sm font-medium text-brand">
        ← News
      </Link>
      <PageTitle title={article.title} />
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={state.tone}>{state.label}</Pill>
          <span className="text-muted">
            By {article.authorName}
            {article.submittedAt && ` · sent in ${whenPerth(article.submittedAt)}`}
            {article.sample && " · example article"}
          </span>
          {live && (
            <Link href={`/news/${article.slug}`} className="font-medium text-brand">
              See it on the site →
            </Link>
          )}
        </div>
        {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
        {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        {article.status === "review" && (
          <Notice tone="info">
            {article.authorName} sent this in for approval. Read it (try Preview), make any small
            edits, then publish or schedule it. Or send it back below with a note.
          </Notice>
        )}
      </div>

      <form action={saveNewsDraft}>
        <ArticleEditor
          courses={courses}
          writerName=""
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
          <PublishControls article={article} />
        </ArticleEditor>
      </form>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {article.status === "review" && (
          <form action={sendNewsBack} className={`${panel} flex flex-col gap-3`}>
            {hidden}
            <h2 className="text-lg font-semibold">Send it back</h2>
            <label htmlFor="note" className="text-sm text-muted">
              What should {article.authorName} change? They&apos;re emailed your note.
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxLength={1000}
              className={`${textInput} py-2`}
            />
            <button type="submit" className={`${secondaryButton} self-start`}>
              Send back with this note
            </button>
          </form>
        )}
        {article.status === "published" && (
          <form action={unpublishNews} className={`${panel} flex flex-col gap-3`}>
            {hidden}
            <h2 className="text-lg font-semibold">Take it down</h2>
            <p className="text-sm text-muted">
              It becomes a draft again, off the news page. You can publish it again later.
            </p>
            <button type="submit" className={`${secondaryButton} self-start`}>
              Unpublish
            </button>
          </form>
        )}
        <form action={deleteNews} className={`${panel} flex flex-col gap-3`}>
          {hidden}
          <h2 className="text-lg font-semibold">Delete</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" className="size-5 accent-brand" />
            Yes, delete this article for good
          </label>
          <button type="submit" className={`${secondaryButton} self-start`}>
            Delete
          </button>
        </form>
      </div>
    </>
  );
}
