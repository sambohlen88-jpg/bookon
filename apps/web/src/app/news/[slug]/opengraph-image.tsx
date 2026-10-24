import { ImageResponse } from "next/og";
import { publishedArticle } from "@bookon/db";
import { getDb } from "@/lib/db";
import { CARD_SIZE, newsCard, pictureFonts } from "@/lib/share-picture";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "A BookOn News article";

/** The preview Facebook, WhatsApp and others show for an article link. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const article = await publishedArticle(getDb(), (await params).slug, new Date());
  return new ImageResponse(await newsCard(article), { ...CARD_SIZE, fonts: await pictureFonts() });
}
