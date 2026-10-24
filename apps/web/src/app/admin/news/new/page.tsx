import Link from "next/link";
import { listEnabledCourses } from "@bookon/db";
import { saveNewsDraft } from "@/app/admin/news/actions";
import { PublishControls } from "@/app/admin/news/publish-controls";
import { PageTitle } from "@/components/admin/ui";
import { ArticleEditor } from "@/components/news/editor";
import { Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { artChoices } from "@/lib/news";

export default async function NewNewsArticle({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin("/admin/news/new");
  const { problem } = await searchParams;
  const courses = artChoices(await listEnabledCourses(getDb()));
  return (
    <>
      <Link href="/admin/news" className="text-sm font-medium text-brand">
        ← News
      </Link>
      <PageTitle title="Write an article" />
      {problem && (
        <div className="mb-4">
          <Notice tone="warning">{problem}</Notice>
        </div>
      )}
      <form action={saveNewsDraft}>
        <ArticleEditor courses={courses} writerName="">
          <PublishControls />
        </ArticleEditor>
      </form>
    </>
  );
}
