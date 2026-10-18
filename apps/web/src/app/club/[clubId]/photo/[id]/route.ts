import { clubPhotoById } from "@bookon/db";
import { clubAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { photoHeaders } from "@/lib/photos";

/** One of a club's own photos, approved or not, for its signed-in team. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; id: string }> },
) {
  const { clubId, id } = await params;
  const access = await clubAccess(clubId);
  const photo = access ? await clubPhotoById(getDb(), id) : null;
  if (!photo || photo.clubId !== access?.club.id) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: photoHeaders(photo.contentType, "private"),
  });
}
