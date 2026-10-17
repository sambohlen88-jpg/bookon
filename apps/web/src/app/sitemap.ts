import type { MetadataRoute } from "next";
import { listCourseDetails } from "@bookon/db";
import { siteUrl } from "@bookon/email";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The pages search engines should know about: home, the course list and each course. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const courses = await listCourseDetails(getDb()).catch(() => []);
  return [
    { url: `${site}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/courses`, changeFrequency: "weekly", priority: 0.8 },
    ...courses.map((c) => ({
      url: `${site}/courses/${c.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
  ];
}
