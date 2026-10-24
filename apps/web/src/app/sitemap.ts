import type { MetadataRoute } from "next";
import {
  listCourseDetails,
  listLiveCoaches,
  openComps,
  publishedArticles,
  upcomingOpenEvents,
} from "@bookon/db";
import { siteUrl } from "@bookon/email";
import { getDb } from "@/lib/db";
import { SEO_PAGES } from "@/lib/seo-pages";

export const dynamic = "force-dynamic";

/** The pages search engines should know about: home, courses, competitions, coaches and the Golf in Perth pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const courses = await listCourseDetails(getDb()).catch(() => []);
  // Made-up sample coaches are never listed.
  const coaches = (await listLiveCoaches(getDb()).catch(() => [])).filter((c) => !c.sample);
  // Open club events (Milestone 21); members-only events are never listed.
  const events = await upcomingOpenEvents(getDb(), new Date()).catch(() => []);
  // Open match play competitions (Milestone 22).
  const comps = await openComps(getDb(), new Date()).catch(() => []);
  // News (Milestone 24).
  const news = (
    await publishedArticles(getDb(), new Date(), { limit: 1000 }).catch(() => ({ articles: [] }))
  ).articles;
  return [
    { url: `${site}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/courses`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/clubs`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/golf`, changeFrequency: "weekly", priority: 0.8 },
    ...SEO_PAGES.map((p) => ({
      url: `${site}/golf/${p.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    { url: `${site}/competitions`, changeFrequency: "daily", priority: 0.7 },
    ...events.map((e) => ({
      url: `${site}/competitions/${e.id}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...comps.map((c) => ({
      url: `${site}/matchplay/${c.id}`,
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
    { url: `${site}/news`, changeFrequency: "daily", priority: 0.7 },
    ...news.map((a) => ({
      url: `${site}/news/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${site}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${site}/terms`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${site}/coaches`, changeFrequency: "daily", priority: 0.7 },
    { url: `${site}/coaching`, changeFrequency: "monthly", priority: 0.4 },
    ...coaches.map((c) => ({
      url: `${site}/coaches/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...courses.map((c) => ({
      url: `${site}/courses/${c.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
  ];
}
