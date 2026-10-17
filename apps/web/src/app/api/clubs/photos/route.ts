import { addClubPhoto, applicationByToken, deleteClubPhoto } from "@bookon/db";
import { getDb } from "@/lib/db";
import { MAX_UPLOAD_BYTES, preparePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Only BookOn's own pages may upload or remove photos. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

const reply = (status: number, message: string) => Response.json({ message }, { status });

/** Upload a photo to a club listing. The listing's private link token proves who's asking. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply(403, "Not allowed.");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 100_000)
    return reply(413, "That photo is too big. Use one under 15 MB.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "That didn't upload. Try again.");
  }
  const db = getDb();
  const application = await applicationByToken(db, String(form.get("token") ?? ""));
  if (!application) return reply(404, "This listing link doesn't work.");
  const rightsBy = String(form.get("rightsBy") ?? "").trim();
  if (!rightsBy || form.get("rights") !== "yes") {
    return reply(400, "Confirm the club owns the photo or may share it, and add your name.");
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return reply(400, "Choose a photo first.");
  if (file.size > MAX_UPLOAD_BYTES)
    return reply(413, "That photo is too big. Use one under 15 MB.");

  const photo = await preparePhoto(Buffer.from(await file.arrayBuffer()));
  if (!photo) return reply(400, "That file isn't a photo we can use. Try a JPEG or PNG.");
  const result = await addClubPhoto(
    db,
    application,
    {
      ...photo,
      caption: String(form.get("caption") ?? "").trim() || null,
      credit: String(form.get("credit") ?? "").trim() || null,
      rightsConfirmedBy: rightsBy,
    },
    new Date(),
  );
  if ("error" in result) {
    return reply(
      409,
      result.error === "limit"
        ? "That's the most photos a listing can have. Remove one to add another."
        : "This listing has been sent, so photos can't be changed here.",
    );
  }
  return Response.json({ id: result.id }, { status: 201 });
}

/** Remove a photo from a listing that hasn't been sent yet. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply(403, "Not allowed.");
  let body: { token?: unknown; photoId?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, "Bad request.");
  }
  const db = getDb();
  const application = await applicationByToken(db, String(body.token ?? ""));
  if (!application) return reply(404, "This listing link doesn't work.");
  await deleteClubPhoto(db, application, String(body.photoId ?? ""));
  return new Response(null, { status: 204 });
}
