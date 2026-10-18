import { ImageResponse } from "next/og";
import { shareByCode } from "@bookon/db";
import { getDb } from "@/lib/db";
import { pictureFonts, sharePicture } from "@/lib/share-picture";
import { siteOrigin } from "@/lib/site";

/** The picture of a share, to send in a group chat. `?download=1` saves it as a file. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const share = await shareByCode(getDb(), code, new Date());
  if (!share) return new Response("This share has expired.", { status: 404 });
  const { element, width, height } = await sharePicture(share, `${await siteOrigin()}/s/${code}`);
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new ImageResponse(element, {
    width,
    height,
    fonts: await pictureFonts(),
    headers: {
      // A share never changes, so the picture can be kept until it expires.
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="bookon-tee-times-${share.params.dateFrom}.png"`,
      "X-Robots-Tag": "noindex",
    },
  });
}
