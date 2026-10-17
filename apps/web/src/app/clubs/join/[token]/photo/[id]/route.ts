import { applicationByToken, clubPhotoById } from "@bookon/db";
import { getDb } from "@/lib/db";
import { photoHeaders } from "@/lib/photos";

/** A photo in a club's own listing, approved or not, for whoever has the listing's link. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const db = getDb();
  const application = await applicationByToken(db, token);
  const photo = application ? await clubPhotoById(db, id) : null;
  if (!photo || photo.applicationId !== application?.id) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(photo.data), {
    headers: photoHeaders(photo.contentType, "private"),
  });
}
