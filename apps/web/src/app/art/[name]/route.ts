import { courseArtSvg } from "@/lib/course-art";

/**
 * Course illustrations as images: /art/collier-park.svg, or -wide.svg for
 * banners. Cached for a year; courseArtUrl adds a version to refresh them.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const match = /^([a-z0-9-]{1,60}?)(-wide)?\.svg$/.exec((await params).name);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(courseArtSvg(match[1]!, { wide: Boolean(match[2]) }), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      // A picture, nothing more: no scripts, no outside requests.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
