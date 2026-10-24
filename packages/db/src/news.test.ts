import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client";
import {
  NewsProblem,
  articlesWaiting,
  createArticle,
  grantAuthor,
  listAuthors,
  publishArticle,
  publishedArticle,
  publishedArticles,
  removeSampleArticles,
  revokeAuthor,
  seedSampleArticles,
  sendArticleBack,
  submitArticle,
  unpublishArticle,
  updateArticle,
  type ArticleInput,
} from "./news";
import { users } from "./schema";
import { listUsersForAdmin } from "./users";

const now = new Date("2026-10-24T01:00:00Z");
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const admin = { email: "owner@example.com", role: "admin" as const };
let handle: DbHandle;
let writerId: string;

const input = (over: Partial<ArticleInput> = {}): ArticleInput => ({
  title: "Summer golf in Perth",
  summary: "Early starts and the sea breeze.",
  body: "## Play early\n\nIt's cooler.",
  category: "tips",
  coverPhotoId: null,
  coverArt: "collier-park",
  coverAlt: "A drawn course",
  ...over,
});

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  const [u] = await handle.db.insert(users).values({ email: "writer@example.com" }).returning();
  writerId = u!.id;
});
afterAll(async () => {
  await handle.close();
});

describe("writing and publishing", () => {
  it("takes an author's article from draft to approval to published", async () => {
    const db = handle.db;
    await grantAuthor(db, writerId, "Wendy Writer", admin, now);
    expect((await listAuthors(db)).map((a) => a.name)).toEqual(["Wendy Writer"]);
    expect((await listUsersForAdmin(db, null))[0]!.groups).toContain("author");

    let article = await createArticle(db, { userId: writerId, name: "Wendy Writer" }, input(), now);
    expect(article).toMatchObject({ status: "draft", slug: "summer-golf-in-perth" });
    article = await submitArticle(db, article, now);
    expect(await articlesWaiting(db)).toBe(1);
    article = await sendArticleBack(db, article, "Add a tip about water.", now);
    expect(article).toMatchObject({ status: "draft", reviewNote: "Add a tip about water." });
    article = await updateArticle(
      db,
      article,
      input({ body: "## Play early\n\nBring water." }),
      "author",
      now,
    );
    article = await submitArticle(db, article, now);

    // Scheduled for tomorrow: not live yet.
    article = await publishArticle(db, article, later(24), admin, now);
    expect(await publishedArticle(db, article.slug, now)).toBeNull();
    expect((await publishedArticle(db, article.slug, later(25)))?.title).toBe(
      "Summer golf in Perth",
    );

    // Once published, the author can't change it, and its address stays.
    await expect(updateArticle(db, article, input(), "author", later(25))).rejects.toThrow(
      NewsProblem,
    );
    const edited = await updateArticle(
      db,
      article,
      input({ title: "A new headline" }),
      "admin",
      later(25),
    );
    expect(edited.slug).toBe("summer-golf-in-perth");

    const off = await unpublishArticle(db, edited, admin, later(26));
    expect(off.status).toBe("draft");
    await revokeAuthor(db, writerId, admin, now);
    expect(await listAuthors(db)).toEqual([]);
  });

  it("keeps addresses unique and checks what's needed", async () => {
    const db = handle.db;
    const a = await createArticle(
      db,
      { userId: null, name: "BookOn team" },
      input({ title: "Same name" }),
      now,
    );
    const b = await createArticle(
      db,
      { userId: null, name: "BookOn team" },
      input({ title: "Same name" }),
      now,
    );
    expect([a.slug, b.slug]).toEqual(["same-name", "same-name-2"]);
    await expect(
      createArticle(db, { userId: null, name: "x" }, input({ coverAlt: "" }), now),
    ).rejects.toThrow("Describe the cover picture");
    await expect(
      createArticle(db, { userId: null, name: "x" }, input({ summary: " " }), now),
    ).rejects.toThrow("summary");
  });
});

describe("the news page", () => {
  it("lists published articles newest first, by category, and adds and removes the samples", async () => {
    const db = handle.db;
    expect(await seedSampleArticles(db, now)).toBe(6);
    expect(await seedSampleArticles(db, now)).toBe(0);
    const all = await publishedArticles(db, now);
    expect(all.total).toBe(6);
    expect(all.articles[0]!.title).toBe("Welcome to BookOn News");
    const tips = await publishedArticles(db, now, { category: "tips" });
    expect(tips.articles.every((a) => a.category === "tips")).toBe(true);
    expect((await publishedArticles(db, now, { limit: 4, page: 2 })).articles).toHaveLength(2);
    expect(await removeSampleArticles(db, admin, now)).toBe(6);
    expect((await publishedArticles(db, now)).total).toBe(0);
  });
});
