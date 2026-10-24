import { perthToUtc } from "@bookon/core";
import type { ArticleInput } from "@bookon/db";

/** Reading the article editor's form (Milestone 24). */
export function parseArticleForm(form: FormData): ArticleInput {
  const text = (name: string) => String(form.get(name) ?? "");
  const kind = text("coverKind");
  return {
    title: text("title"),
    summary: text("summary"),
    body: text("body"),
    category: text("category") || null,
    coverPhotoId: kind === "photo" ? text("coverPhotoId") || null : null,
    coverArt: kind === "art" ? text("coverArt") || null : null,
    coverAlt: kind === "photo" || kind === "art" ? text("coverAlt") || null : null,
  };
}

/** When to publish: a Perth date and time from the form, or null if not given or not valid. */
export function parsePublishAt(form: FormData): Date | null {
  const date = String(form.get("publishDate") ?? "");
  const time = String(form.get("publishTime") ?? "") || "06:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return perthToUtc(date, time);
}
