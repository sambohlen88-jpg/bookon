import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { articlesForAuthor } from "@bookon/db";
import { saveAuthorProfile } from "@/app/write/actions";
import { Pill, panel } from "@/components/admin/ui";
import { Field, TextArea } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requireAuthor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { articleState } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Write · BookOn", robots: { index: false } };

const DONE: Record<string, string> = {
  deleted: "Deleted.",
  profile: "Saved.",
};

/** An author's own page (Milestone 24): their articles and how they're shown. */
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user, author } = await requireAuthor("/write");
  if (!author) redirect("/admin/news");
  const articles = await articlesForAuthor(getDb(), user.id);
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <h1 className="text-3xl font-bold tracking-tight">Write for BookOn</h1>
        <p className="mt-2 text-muted">
          Write an article, then send it in. BookOn reads it and publishes it on the{" "}
          <Link href="/news" className="text-brand underline">
            news page
          </Link>
          , or sends it back with a note.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
        </div>
        <Link href="/write/new" className={`${primaryButton} mt-6`}>
          Write an article
        </Link>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Your articles</h2>
          {articles.length === 0 ? (
            <p className="text-muted">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {articles.map((a) => {
                const state = articleState(a);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <Link href={`/write/${a.id}`} className="font-medium text-brand">
                      {a.title}
                    </Link>
                    <Pill tone={state.tone}>{state.label}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${panel} mt-10`}>
          <h2 className="text-lg font-semibold">How you&apos;re shown</h2>
          <form action={saveAuthorProfile} className="mt-3 flex flex-col gap-4">
            <Field
              label="Your name, as shown on your articles"
              name="name"
              required
              maxLength={80}
              defaultValue={author.name}
            />
            <TextArea
              label="A line or two about you"
              name="bio"
              rows={3}
              maxLength={500}
              defaultValue={author.bio}
              hint="Shown at the end of your articles."
            />
            <button type="submit" className={`${secondaryButton} self-start`}>
              Save
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
