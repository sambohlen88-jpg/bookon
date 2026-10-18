import { coachPhotoById } from "@bookon/db";
import { getDb } from "@/lib/db";
import { photoHeaders } from "@/lib/photos";

/** A coach photo BookOn has approved. Nothing else is served here. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.replace(/\.webp$/, "");
  const photo = await coachPhotoById(getDb(), id);
  if (!photo || photo.status !== "approved") return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: photoHeaders(photo.contentType, "public"),
  });
}
