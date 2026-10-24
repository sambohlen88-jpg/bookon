import { articlePhoto } from "@bookon/db";
import { getDb } from "@/lib/db";
import { photoHeaders } from "@/lib/photos";

/** News pictures (Milestone 24). Public: they're in published articles and previews. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const photo = await articlePhoto(getDb(), (await params).id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: photoHeaders(photo.contentType, "public"),
  });
}
