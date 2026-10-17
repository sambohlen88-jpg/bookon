import type { MetadataRoute } from "next";
import { siteUrl } from "@bookon/email";

/** Keep crawlers out of search results and Book links, so they don't hit clubs or skew reports. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/go/", "/search", "/api/", "/alerts/", "/dev/", "/clubs/join"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
