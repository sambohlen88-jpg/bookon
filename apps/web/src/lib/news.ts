import { formatPerthDay, formatPerthTime, perthDate } from "@bookon/core";
import type { Article } from "@bookon/db";

/** Where an article is up to (Milestone 24), for lists in Admin and /write. */
export function articleState(
  article: Article,
  now = new Date(),
): { label: string; tone: "good" | "warn" | "muted" } {
  if (article.status === "review") return { label: "Waiting for approval", tone: "warn" };
  if (article.status === "draft")
    return { label: article.reviewNote ? "Sent back for changes" : "Draft", tone: "muted" };
  if (article.publishAt && article.publishAt > now)
    return { label: `Scheduled for ${whenPerth(article.publishAt)}`, tone: "warn" };
  return { label: "Published", tone: "good" };
}

export function whenPerth(d: Date): string {
  return `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;
}

/** Courses whose drawings can be a cover picture. */
export function artChoices(courses: { slug: string; name: string; kind?: string }[]) {
  return courses
    .filter((c) => !c.kind || c.kind === "course")
    .map((c) => ({ slug: c.slug, name: c.name }));
}

/** The cover picture's address: an uploaded picture, or a course drawing. */
export function coverUrl(article: Pick<Article, "coverPhotoId" | "coverArt">): string | null {
  if (article.coverPhotoId) return `/news-photos/${article.coverPhotoId}`;
  if (article.coverArt) return `/art/${article.coverArt}-wide.svg`;
  return null;
}
