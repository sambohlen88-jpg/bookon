"use server";

import { redirect } from "next/navigation";
import {
  NewsProblem,
  articleById,
  createArticle,
  deleteArticle,
  setAuthorProfile,
  submitArticle,
  updateArticle,
  type Article,
} from "@bookon/db";
import { articleSubmittedEmail, createMailer } from "@bookon/email";
import { adminEmail, requireAuthor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { parseArticleForm } from "@/lib/news-form";
import { siteOrigin } from "@/lib/site";

/**
 * Authors writing news (Milestone 24). Every action checks they're an
 * author and the article is theirs. Authors can't publish: they send
 * articles to the admin.
 */

function go(path: string, query: Record<string, string> = {}): never {
  const q = new URLSearchParams(query).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

async function writer() {
  const access = await requireAuthor("/write");
  if (!access.author) go("/admin/news");
  return { user: access.user, author: access.author! };
}

async function attempt<T>(back: string, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    if (error instanceof NewsProblem) go(back, { problem: error.message });
    throw error;
  }
}

/** Save the editor: a new article, or changes to one of theirs. */
async function save(formData: FormData): Promise<Article> {
  const { user, author } = await writer();
  const db = getDb();
  const input = parseArticleForm(formData);
  const id = String(formData.get("articleId") ?? "");
  if (!id)
    return attempt("/write/new", () =>
      createArticle(db, { userId: user.id, name: author.name }, input, new Date()),
    );
  const article = await articleById(db, id);
  if (!article || article.authorId !== user.id)
    go("/write", { problem: "That article wasn't found." });
  return attempt(`/write/${article!.id}`, () =>
    updateArticle(db, article!, input, "author", new Date()),
  );
}

export async function saveMyDraft(formData: FormData) {
  const article = await save(formData);
  go(`/write/${article.id}`, { done: "saved" });
}

export async function sendForApproval(formData: FormData) {
  const article = await save(formData);
  const db = getDb();
  const sent =
    article.status === "review"
      ? article
      : await attempt(`/write/${article.id}`, () => submitArticle(db, article, new Date()));
  const to = adminEmail();
  if (to && article.status !== "review")
    await createMailer(db).send(
      articleSubmittedEmail({
        to,
        article: sent,
        link: `${await siteOrigin()}/admin/news/${sent.id}`,
      }),
    );
  go(`/write/${sent.id}`, { done: "sent" });
}

export async function deleteMyDraft(formData: FormData) {
  const { user } = await writer();
  const db = getDb();
  const article = await articleById(db, String(formData.get("articleId") ?? ""));
  if (!article || article.authorId !== user.id) go("/write");
  if (article!.status === "published")
    go(`/write/${article!.id}`, { problem: "It's published, so ask BookOn to take it down." });
  if (String(formData.get("confirm") ?? "") !== "yes")
    go(`/write/${article!.id}`, { problem: "Tick the box to confirm deleting it." });
  await deleteArticle(db, article!, null, new Date());
  go("/write", { done: "deleted" });
}

export async function saveAuthorProfile(formData: FormData) {
  const { user } = await writer();
  await attempt("/write", () =>
    setAuthorProfile(
      getDb(),
      user.id,
      String(formData.get("name") ?? ""),
      String(formData.get("bio") ?? "") || null,
    ),
  );
  go("/write", { done: "profile" });
}
