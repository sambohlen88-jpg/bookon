import Link from "next/link";
import { NEWS_CATEGORIES, perthDate, type NewsCategory } from "@bookon/core";
import { articlesForAdmin, listAuthors } from "@bookon/db";
import { addSampleNews, removeSampleNews } from "@/app/admin/news/actions";
import { PageTitle, Pill, panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { articleState } from "@/lib/news";

const DONE: Record<string, string> = {
  deleted: "Deleted.",
  "samples-added": "The example articles are on the news page.",
  "samples-there": "The example articles are already there.",
  "samples-removed": "The example articles are gone.",
};

/** Admin → News (Milestone 24): every article, what's waiting for approval, and the authors. */
export default async function AdminNews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin("/admin/news");
  const db = getDb();
  const all = await articlesForAdmin(db);
  const authors = await listAuthors(db);
  const query = await searchParams;
  const now = new Date();
  const groups = [
    { title: "Waiting for your approval", list: all.filter((a) => a.status === "review") },
    { title: "Drafts", list: all.filter((a) => a.status === "draft") },
    { title: "Scheduled", list: all.filter((a) => a.status === "published" && a.publishAt! > now) },
    {
      title: "Published",
      list: all.filter((a) => a.status === "published" && a.publishAt! <= now),
    },
  ];
  const samples = all.filter((a) => a.sample).length;

  return (
    <>
      <PageTitle
        title="News"
        intro={
          <>
            Articles on the{" "}
            <Link href="/news" className="text-brand underline">
              news page
            </Link>
            , newest first. Authors write and send articles in; only you publish them.
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-2">
        {query.done && DONE[query.done] && <Notice tone="info">{DONE[query.done]}</Notice>}
        {query.problem && <Notice tone="warning">{query.problem}</Notice>}
      </div>
      <Link href="/admin/news/new" className={`${primaryButton} mb-8`}>
        Write an article
      </Link>

      {groups.map((g) =>
        g.list.length === 0 ? null : (
          <section key={g.title} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">
              {g.title} <span className="font-normal text-muted">({g.list.length})</span>
            </h2>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Article</th>
                    <th className={thClass}>By</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {g.list.map((a) => {
                    const state = articleState(a, now);
                    return (
                      <tr key={a.id}>
                        <td className={tdClass}>
                          <Link href={`/admin/news/${a.id}`} className="font-medium text-brand">
                            {a.title}
                          </Link>
                          <span className="block text-muted">
                            {a.category
                              ? NEWS_CATEGORIES[a.category as NewsCategory]
                              : "No category"}
                            {a.sample && " · example"} · changed {perthDate(a.updatedAt)}
                          </span>
                        </td>
                        <td className={tdClass}>{a.authorName}</td>
                        <td className={tdClass}>
                          <Pill tone={state.tone}>{state.label}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
      {all.length === 0 && <p className="mb-8 text-muted">No articles yet.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-semibold">Authors</h2>
          {authors.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nobody else writes for BookOn yet.</p>
          ) : (
            <ul className="mt-2 text-sm">
              {authors.map((a) => (
                <li key={a.userId} className="border-t border-border py-2 first:border-t-0">
                  <Link href={`/admin/users/${a.userId}`} className="font-medium text-brand">
                    {a.name}
                  </Link>{" "}
                  <span className="text-muted">· {a.email}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">
            To add an author, they sign in to BookOn once. Then open them in{" "}
            <Link href="/admin/users" className="text-brand underline">
              Users
            </Link>{" "}
            and press &ldquo;Let them write news&rdquo;. Authors write at /write.
          </p>
        </section>
        <section className={panel}>
          <h2 className="text-lg font-semibold">Example articles</h2>
          <p className="mt-2 text-sm text-muted">
            {samples
              ? `${samples} example articles are on the news page. Remove them once you've written a few of your own.`
              : "Six example articles about golf in Perth, to fill the news page while you get started."}
          </p>
          <form action={samples ? removeSampleNews : addSampleNews} className="mt-3">
            <button type="submit" className={secondaryButton}>
              {samples ? "Remove all examples" : "Add the example articles"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
