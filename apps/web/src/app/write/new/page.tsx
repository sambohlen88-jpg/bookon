import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listEnabledCourses } from "@bookon/db";
import { saveMyDraft } from "@/app/write/actions";
import { AuthorControls } from "@/app/write/author-controls";
import { ArticleEditor } from "@/components/news/editor";
import { SiteHeader } from "@/components/site-header";
import { Notice } from "@/components/ui";
import { requireAuthor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { artChoices } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Write an article · BookOn", robots: { index: false } };

export default async function WriteNew({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { author } = await requireAuthor("/write/new");
  if (!author) redirect("/admin/news/new");
  const { problem } = await searchParams;
  const courses = artChoices(await listEnabledCourses(getDb()));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <Link href="/write" className="text-sm font-medium text-brand">
          ← Your articles
        </Link>
        <h1 className="mb-6 mt-2 text-3xl font-bold tracking-tight">Write an article</h1>
        {problem && (
          <div className="mb-4">
            <Notice tone="warning">{problem}</Notice>
          </div>
        )}
        <form action={saveMyDraft}>
          <ArticleEditor courses={courses} writerName={author.name}>
            <AuthorControls waiting={false} />
          </ArticleEditor>
        </form>
      </main>
    </>
  );
}
