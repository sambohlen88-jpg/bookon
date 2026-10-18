import { ImageResponse } from "next/og";
import { shareByCode } from "@bookon/db";
import { getDb } from "@/lib/db";
import { CARD_SIZE, pictureFonts, shareCard } from "@/lib/share-picture";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Tee times shared from BookOn";

/** The preview a group chat shows for a share link. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const share = await shareByCode(getDb(), code, new Date());
  return new ImageResponse(await shareCard(share), { ...CARD_SIZE, fonts: await pictureFonts() });
}
