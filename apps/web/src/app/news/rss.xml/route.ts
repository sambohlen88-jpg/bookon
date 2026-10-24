import { publishedArticles } from "@bookon/db";
import { siteUrl } from "@bookon/email";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** BookOn News as an RSS feed (Milestone 24), for news readers. */
export async function GET() {
  const site = siteUrl();
  const { articles } = await publishedArticles(getDb(), new Date(), { limit: 30 });
  const items = articles
    .map(
      (a) => `    <item>
      <title>${xml(a.title)}</title>
      <link>${site}/news/${a.slug}</link>
      <guid isPermaLink="true">${site}/news/${a.slug}</guid>
      <description>${xml(a.summary)}</description>
      <pubDate>${a.publishAt!.toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BookOn News</title>
    <link>${site}/news</link>
    <description>Golf news, tips and what's on around Perth's public courses.</description>
    <language>en-au</language>
${items}
  </channel>
</rss>
`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    },
  );
}
