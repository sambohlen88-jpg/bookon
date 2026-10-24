import type { MetadataRoute } from "next";
import { siteUrl } from "@bookon/email";
import { sitePassword } from "@/lib/private-site";

// Read on each request, so turning private test mode on or off doesn't need a rebuild.
export const dynamic = "force-dynamic";

/** Keep crawlers out of search results and Book links, so they don't hit clubs or skew reports. */
export default function robots(): MetadataRoute.Robots {
  // Private test mode: nothing should be indexed.
  if (sitePassword()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/go/",
        "/search",
        "/api/",
        "/alerts/",
        "/dev/",
        "/clubs/join",
        "/admin",
        "/club/",
        "/lessons/",
        "/sessions/",
        "/entries/",
        "/matchplay/entry/",
        "/calendar/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
