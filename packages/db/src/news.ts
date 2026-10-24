import { and, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import {
  NEWS_BODY_MAX,
  NEWS_PAGE_SIZE,
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
  isNewsCategory,
  slugify,
} from "@bookon/core";
import { logChange, type Actor } from "./admin";
import type { Database } from "./client";
import { appSettings, articlePhotos, articles, authors, users } from "./schema";
import { SAMPLE_ARTICLES } from "./news-samples";

/**
 * BookOn News (Milestone 24). The admin writes and publishes. Authors write
 * and send articles in; only the admin publishes them. Each step only moves
 * an article from the state it expects.
 */

export type Article = typeof articles.$inferSelect;
export type Author = typeof authors.$inferSelect;
export class NewsProblem extends Error {}

export interface ArticleInput {
  title: string;
  summary: string;
  body: string;
  category: string | null;
  coverPhotoId: string | null;
  coverArt: string | null;
  coverAlt: string | null;
}

function clean(input: ArticleInput): ArticleInput {
  const title = input.title.trim().slice(0, NEWS_TITLE_MAX);
  if (!title) throw new NewsProblem("Give the article a headline.");
  const summary = input.summary.trim().slice(0, NEWS_SUMMARY_MAX);
  if (!summary)
    throw new NewsProblem("Add a short summary: it shows on the news page and in shared links.");
  const body = input.body.trim();
  if (!body) throw new NewsProblem("The article is empty.");
  if (body.length > NEWS_BODY_MAX)
    throw new NewsProblem("That article is too long. Split it in two?");
  const hasCover = Boolean(input.coverPhotoId || input.coverArt);
  if (hasCover && !input.coverAlt?.trim())
    throw new NewsProblem(
      "Describe the cover picture in a few words, for people who can't see it.",
    );
  return {
    title,
    summary,
    body,
    category: isNewsCategory(input.category) ? input.category : null,
    coverPhotoId:
      input.coverPhotoId && /^[0-9a-f-]{36}$/i.test(input.coverPhotoId) ? input.coverPhotoId : null,
    coverArt: input.coverArt && /^[a-z0-9-]{1,60}$/.test(input.coverArt) ? input.coverArt : null,
    coverAlt: hasCover ? input.coverAlt!.trim().slice(0, 200) : null,
  };
}

/** A slug nobody else is using: "my-title", then "my-title-2" and so on. */
async function freeSlug(db: Database, title: string, except?: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await db
        .select({ slug: articles.slug, id: articles.id })
        .from(articles)
        .where(sql`${articles.slug} = ${base} or ${articles.slug} like ${`${base}-%`}`)
    )
      .filter((r) => r.id !== except)
      .map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createArticle(
  db: Database,
  writer: { userId: string | null; name: string },
  input: ArticleInput,
  now: Date,
): Promise<Article> {
  const values = clean(input);
  const [row] = await db
    .insert(articles)
    .values({
      ...values,
      slug: await freeSlug(db, values.title),
      authorId: writer.userId,
      authorName: writer.name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row!;
}

/**
 * Save changes. Authors can change their own drafts, and articles waiting
 * for approval; once published, only the admin can. The address stays the
 * same once published, so shared links keep working.
 */
export async function updateArticle(
  db: Database,
  article: Article,
  input: ArticleInput,
  by: "admin" | "author",
  now: Date,
): Promise<Article> {
  if (by === "author" && article.status === "published")
    throw new NewsProblem("It's published, so only the admin can change it now.");
  const values = clean(input);
  const slug =
    article.status === "published" ? article.slug : await freeSlug(db, values.title, article.id);
  const [row] = await db
    .update(articles)
    .set({ ...values, slug, updatedAt: now })
    .where(and(eq(articles.id, article.id), eq(articles.status, article.status)))
    .returning();
  if (!row) throw new NewsProblem("It changed while you were editing. Open it again.");
  return row;
}

async function move(
  db: Database,
  article: Article,
  from: Article["status"][],
  set: Partial<typeof articles.$inferInsert>,
  problem: string,
): Promise<Article> {
  const [row] = await db
    .update(articles)
    .set(set)
    .where(and(eq(articles.id, article.id), inArray(articles.status, from)))
    .returning();
  if (!row) throw new NewsProblem(problem);
  return row;
}

/** An author sends a draft to the admin. */
export function submitArticle(db: Database, article: Article, now: Date) {
  return move(
    db,
    article,
    ["draft"],
    { status: "review", submittedAt: now, reviewNote: null, updatedAt: now },
    "It's already been sent in.",
  );
}

/** The admin sends an author's article back with a note. */
export function sendArticleBack(db: Database, article: Article, note: string, now: Date) {
  return move(
    db,
    article,
    ["review"],
    { status: "draft", reviewNote: note.trim().slice(0, 1000) || null, updatedAt: now },
    "It isn't waiting for approval any more.",
  );
}

/** The admin publishes now, or from a later time. */
export async function publishArticle(
  db: Database,
  article: Article,
  publishAt: Date,
  actor: Actor,
  now: Date,
): Promise<Article> {
  const row = await move(
    db,
    article,
    ["draft", "review"],
    { status: "published", publishAt, approvedBy: actor.email, reviewNote: null, updatedAt: now },
    "It's already published.",
  );
  await logChange(
    db,
    actor,
    {
      action: publishAt > now ? "Scheduled a news article" : "Published a news article",
      details: { title: row.title, author: row.authorName },
    },
    now,
  );
  return row;
}

/** Change when a scheduled article goes live. */
export function rescheduleArticle(db: Database, article: Article, publishAt: Date, now: Date) {
  return move(db, article, ["published"], { publishAt, updatedAt: now }, "It isn't published.");
}

export async function unpublishArticle(db: Database, article: Article, actor: Actor, now: Date) {
  const row = await move(
    db,
    article,
    ["published"],
    { status: "draft", publishAt: null, updatedAt: now },
    "It isn't published.",
  );
  await logChange(
    db,
    actor,
    { action: "Unpublished a news article", details: { title: row.title } },
    now,
  );
  return row;
}

export async function deleteArticle(
  db: Database,
  article: Article,
  actor: Actor | null,
  now: Date,
) {
  await db.delete(articles).where(eq(articles.id, article.id));
  if (actor)
    await logChange(
      db,
      actor,
      { action: "Deleted a news article", details: { title: article.title } },
      now,
    );
}

export async function articleById(db: Database, id: string): Promise<Article | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(articles).where(eq(articles.id, id));
  return row ?? null;
}

const live = (now: Date) => and(eq(articles.status, "published"), lte(articles.publishAt, now));

/** A published article by its address, once its time has come. */
export async function publishedArticle(
  db: Database,
  slug: string,
  now: Date,
): Promise<Article | null> {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), live(now)));
  return row ?? null;
}

/** The news page: newest first, a page at a time, optionally one category. */
export async function publishedArticles(
  db: Database,
  now: Date,
  options: { category?: string | null; page?: number; limit?: number; exceptId?: string } = {},
): Promise<{ articles: Article[]; total: number }> {
  const limit = options.limit ?? NEWS_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const where = and(
    live(now),
    options.category && isNewsCategory(options.category)
      ? eq(articles.category, options.category)
      : undefined,
    options.exceptId ? ne(articles.id, options.exceptId) : undefined,
  );
  const rows = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.publishAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const [total] = await db.select({ n: count() }).from(articles).where(where);
  return { articles: rows, total: Number(total?.n ?? 0) };
}

/** Every article, for the admin's list. */
export function articlesForAdmin(db: Database) {
  return db.select().from(articles).orderBy(desc(articles.updatedAt));
}

export function articlesForAuthor(db: Database, userId: string) {
  return db
    .select()
    .from(articles)
    .where(eq(articles.authorId, userId))
    .orderBy(desc(articles.updatedAt));
}

export async function articlesWaiting(db: Database): Promise<number> {
  const [row] = await db.select({ n: count() }).from(articles).where(eq(articles.status, "review"));
  return Number(row?.n ?? 0);
}

/* Pictures */

export async function addArticlePhoto(
  db: Database,
  userId: string | null,
  photo: { data: Buffer; width: number; height: number; contentType: string },
  rightsConfirmedBy: string,
  now: Date,
): Promise<string> {
  const [row] = await db
    .insert(articlePhotos)
    .values({ ...photo, uploadedBy: userId, rightsConfirmedBy, createdAt: now })
    .returning({ id: articlePhotos.id });
  return row!.id;
}

export async function articlePhoto(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(articlePhotos).where(eq(articlePhotos.id, id));
  return row ?? null;
}

/* Authors */

export async function authorFor(db: Database, userId: string): Promise<Author | null> {
  const [row] = await db.select().from(authors).where(eq(authors.userId, userId));
  return row ?? null;
}

export function listAuthors(db: Database) {
  return db
    .select({
      userId: authors.userId,
      name: authors.name,
      email: users.email,
      createdAt: authors.createdAt,
    })
    .from(authors)
    .innerJoin(users, eq(users.id, authors.userId))
    .orderBy(authors.name);
}

export async function grantAuthor(
  db: Database,
  userId: string,
  name: string,
  actor: Actor,
  now: Date,
): Promise<void> {
  const display = name.trim().slice(0, 80);
  if (!display) throw new NewsProblem("Add the name to show on their articles.");
  await db
    .insert(authors)
    .values({ userId, name: display, grantedBy: actor.email, createdAt: now })
    .onConflictDoUpdate({ target: authors.userId, set: { name: display } });
  await logChange(
    db,
    actor,
    { action: "Made someone a news author", details: { name: display } },
    now,
  );
}

/** Take away writing. Their articles stay, under their name. */
export async function revokeAuthor(db: Database, userId: string, actor: Actor, now: Date) {
  const [row] = await db.delete(authors).where(eq(authors.userId, userId)).returning();
  if (row)
    await logChange(
      db,
      actor,
      { action: "Stopped someone writing news", details: { name: row.name } },
      now,
    );
}

export async function setAuthorProfile(
  db: Database,
  userId: string,
  name: string,
  bio: string | null,
) {
  const display = name.trim().slice(0, 80);
  if (!display) throw new NewsProblem("Add your name, as shown on your articles.");
  await db
    .update(authors)
    .set({ name: display, bio: bio?.trim().slice(0, 500) || null })
    .where(eq(authors.userId, userId));
}

/* Example articles */

/** Add the example articles, once. Returns how many were added. */
export async function seedSampleArticles(db: Database, now: Date): Promise<number> {
  const [existing] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.sample, true));
  if (Number(existing?.n ?? 0) > 0) return 0;
  for (const [i, sample] of SAMPLE_ARTICLES.entries()) {
    const at = new Date(now.getTime() - (i * 4 + 1) * 86_400_000);
    await db.insert(articles).values({
      ...sample,
      slug: await freeSlug(db, sample.title),
      status: "published",
      publishAt: at,
      authorName: "BookOn team",
      approvedBy: "sample",
      sample: true,
      createdAt: at,
      updatedAt: at,
    });
  }
  return SAMPLE_ARTICLES.length;
}

export async function removeSampleArticles(db: Database, actor: Actor, now: Date): Promise<number> {
  const gone = await db
    .delete(articles)
    .where(eq(articles.sample, true))
    .returning({ id: articles.id });
  if (gone.length)
    await logChange(
      db,
      actor,
      { action: "Removed the example news articles", details: { count: gone.length } },
      now,
    );
  return gone.length;
}

/* Business details, for the privacy policy and terms */

export interface BusinessDetails {
  /** The business or company name, once registered. */
  name?: string;
  abn?: string;
}

export async function businessDetails(db: Database): Promise<BusinessDetails> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "business"));
  return (row?.value as BusinessDetails | undefined) ?? {};
}

export async function setBusinessDetails(
  db: Database,
  details: BusinessDetails,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "business", value: details, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: details, updatedAt: now } });
  await logChange(db, actor, { action: "Changed business details", details: { ...details } }, now);
}

/** The writer's email, to tell them about their article. */
export async function articleAuthorEmail(db: Database, article: Article): Promise<string | null> {
  if (!article.authorId) return null;
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, article.authorId));
  return row?.email ?? null;
}
