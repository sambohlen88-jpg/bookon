import { clubPhotoById } from "@bookon/db";
import { isAdminRequest } from "@/lib/access";
import { getDb } from "@/lib/db";
import { photoHeaders } from "@/lib/photos";

/** Any club photo, approved or not, for admins reviewing it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return new Response("Not found", { status: 404 });
  const photo = await clubPhotoById(getDb(), (await params).id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: photoHeaders(photo.contentType, "private"),
  });
}
