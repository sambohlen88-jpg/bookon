"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  NewsProblem,
  articleAuthorEmail,
  articleById,
  createArticle,
  deleteArticle,
  grantAuthor,
  publishArticle,
  removeSampleArticles,
  rescheduleArticle,
  revokeAuthor,
  seedSampleArticles,
  sendArticleBack,
  unpublishArticle,
  updateArticle,
  type Article,
} from "@bookon/db";
import { articleApprovedEmail, articleSentBackEmail, createMailer } from "@bookon/email";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { parseArticleForm, parsePublishAt } from "@/lib/news-form";
import { whenPerth } from "@/lib/news";
import { siteOrigin } from "@/lib/site";

/** Admin → News (Milestone 24). Every action checks it's the admin; each decision is its own action. */

const ADMIN_NAME = "BookOn team";

function go(path: string, query: Record<string, string> = {}): never {
  const q = new URLSearchParams(query).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

function refresh(article?: Article) {
  revalidatePath("/news");
  revalidatePath("/");
  if (article) revalidatePath(`/news/${article.slug}`);
}

async function attempt<T>(back: string, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    if (error instanceof NewsProblem) go(back, { problem: error.message });
    throw error;
  }
}

async function articleFrom(formData: FormData) {
  const article = await articleById(getDb(), String(formData.get("articleId") ?? ""));
  if (!article) go("/admin/news", { problem: "That article wasn't found." });
  return article!;
}

/** Save what's in the editor: a new article, or changes to one. */
async function save(formData: FormData): Promise<Article> {
  const db = getDb();
  const input = parseArticleForm(formData);
  const id = String(formData.get("articleId") ?? "");
  if (!id)
    return attempt("/admin/news/new", () =>
      createArticle(db, { userId: null, name: ADMIN_NAME }, input, new Date()),
    );
  const article = await articleFrom(formData);
  return attempt(`/admin/news/${article.id}`, () =>
    updateArticle(db, article, input, "admin", new Date()),
  );
}

async function tellAuthor(article: Article, kind: "approved" | "sent-back") {
  const db = getDb();
  const to = await articleAuthorEmail(db, article);
  if (!to) return;
  const site = await siteOrigin();
  const now = new Date();
  const scheduled =
    article.publishAt && article.publishAt > now ? whenPerth(article.publishAt) : null;
  await createMailer(db).send(
    kind === "approved"
      ? articleApprovedEmail({
          to,
          article,
          when: scheduled,
          link: scheduled ? `${site}/write` : `${site}/news/${article.slug}`,
        })
      : articleSentBackEmail({ to, article, link: `${site}/write/${article.id}` }),
  );
}

export async function saveNewsDraft(formData: FormData) {
  await requireAdmin();
  const article = await save(formData);
  refresh(article);
  go(`/admin/news/${article.id}`, { done: "saved" });
}

export async function publishNewsNow(formData: FormData) {
  const { actor } = await requireAdmin();
  const article = await save(formData);
  const now = new Date();
  const published =
    article.status === "published"
      ? await attempt(`/admin/news/${article.id}`, () =>
          rescheduleArticle(getDb(), article, now, now),
        )
      : await attempt(`/admin/news/${article.id}`, () =>
          publishArticle(getDb(), article, now, actor, now),
        );
  if (article.status === "review") await tellAuthor(published, "approved");
  refresh(published);
  go(`/admin/news/${published.id}`, { done: "published" });
}

export async function scheduleNews(formData: FormData) {
  const { actor } = await requireAdmin();
  const at = parsePublishAt(formData);
  const now = new Date();
  const back = String(formData.get("articleId") ?? "")
    ? `/admin/news/${String(formData.get("articleId"))}`
    : "/admin/news/new";
  if (!at || at <= now) go(back, { problem: "Pick a day and time in the future to publish it." });
  const article = await save(formData);
  const scheduled =
    article.status === "published"
      ? await attempt(`/admin/news/${article.id}`, () =>
          rescheduleArticle(getDb(), article, at!, now),
        )
      : await attempt(`/admin/news/${article.id}`, () =>
          publishArticle(getDb(), article, at!, actor, now),
        );
  if (article.status === "review") await tellAuthor(scheduled, "approved");
  refresh(scheduled);
  go(`/admin/news/${scheduled.id}`, { done: "scheduled" });
}

export async function sendNewsBack(formData: FormData) {
  await requireAdmin();
  const article = await articleFrom(formData);
  const note = String(formData.get("note") ?? "").trim();
  if (!note)
    go(`/admin/news/${article.id}`, { problem: "Add a note so the author knows what to change." });
  const back = await attempt(`/admin/news/${article.id}`, () =>
    sendArticleBack(getDb(), article, note, new Date()),
  );
  await tellAuthor(back, "sent-back");
  go(`/admin/news/${back.id}`, { done: "sent-back" });
}

export async function unpublishNews(formData: FormData) {
  const { actor } = await requireAdmin();
  const article = await articleFrom(formData);
  const off = await attempt(`/admin/news/${article.id}`, () =>
    unpublishArticle(getDb(), article, actor, new Date()),
  );
  refresh(article);
  go(`/admin/news/${off.id}`, { done: "unpublished" });
}

export async function deleteNews(formData: FormData) {
  const { actor } = await requireAdmin();
  const article = await articleFrom(formData);
  if (String(formData.get("confirm") ?? "") !== "yes")
    go(`/admin/news/${article.id}`, { problem: "Tick the box to confirm deleting it." });
  await deleteArticle(getDb(), article, actor, new Date());
  refresh(article);
  go("/admin/news", { done: "deleted" });
}

export async function addSampleNews() {
  await requireAdmin();
  const added = await seedSampleArticles(getDb(), new Date());
  refresh();
  go("/admin/news", { done: added ? "samples-added" : "samples-there" });
}

export async function removeSampleNews() {
  const { actor } = await requireAdmin();
  await removeSampleArticles(getDb(), actor, new Date());
  refresh();
  go("/admin/news", { done: "samples-removed" });
}

/* Authors, from Admin → Users */

export async function makeAuthor(formData: FormData) {
  const { actor } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  await attempt(`/admin/users/${userId}`, () =>
    grantAuthor(getDb(), userId, String(formData.get("name") ?? ""), actor, new Date()),
  );
  revalidatePath("/admin/users");
  go(`/admin/users/${userId}`, { done: "author" });
}

export async function stopAuthor(formData: FormData) {
  const { actor } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  await revokeAuthor(getDb(), userId, actor, new Date());
  revalidatePath("/admin/users");
  go(`/admin/users/${userId}`, { done: "not-author" });
}
