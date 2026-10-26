import { formatPerthDay } from "@bookon/core";
import { publishedArticles, upcomingOpenEvents } from "@bookon/db";
import { getDb } from "@/lib/db";
import type { NavFeature } from "@/lib/site-nav";

export const dynamic = "force-dynamic";

/**
 * What the Competitions and News menus feature (Milestone 25): the next open
 * event and the latest article. Fetched when a menu first opens, so pages
 * built ahead of time don't need the database.
 */
export async function GET() {
  const now = new Date();
  const db = getDb();
  const features: NavFeature[] = [];
  const [event] = (await upcomingOpenEvents(db, now).catch(() => [])).filter(
    (e) => e.entriesClose > now,
  );
  if (event)
    features.push({
      section: "competitions",
      kicker: `Next up · ${formatPerthDay(event.date)}`,
      title: event.title,
      href: `/competitions/${event.id}`,
    });
  const [article] = (await publishedArticles(db, now, { limit: 1 }).catch(() => ({ articles: [] })))
    .articles;
  if (article)
    features.push({
      section: "news",
      kicker: "Latest",
      title: article.title,
      href: `/news/${article.slug}`,
    });
  return Response.json(features, { headers: { "Cache-Control": "public, max-age=300" } });
}
