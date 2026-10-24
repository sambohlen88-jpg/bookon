import { addArticlePhoto, authorFor } from "@bookon/db";
import { isAdminEmail } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MAX_UPLOAD_BYTES, preparePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

const reply = (status: number, message: string) => Response.json({ message }, { status });

/** A picture for a news article (Milestone 24), from the admin or an author. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply(403, "Not allowed.");
  const user = await currentUser();
  if (!user) return reply(403, "Sign in first.");
  const db = getDb();
  if (!isAdminEmail(user.email) && !(await authorFor(db, user.id)))
    return reply(403, "Only BookOn's writers can add pictures.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000)
    return reply(413, "That picture is too big. Use one under 15 MB.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "That didn't upload. Try again.");
  }
  const rightsBy = String(form.get("rightsBy") ?? "").trim();
  if (!rightsBy || form.get("rights") !== "yes")
    return reply(400, "Confirm you may use this picture, and add your name.");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return reply(400, "Choose a picture first.");
  if (file.size > MAX_UPLOAD_BYTES)
    return reply(413, "That picture is too big. Use one under 15 MB.");
  const photo = await preparePhoto(Buffer.from(await file.arrayBuffer()));
  if (!photo) return reply(400, "That file isn't a picture we can use. Try a JPEG or PNG.");
  const id = await addArticlePhoto(db, user.id, photo, rightsBy.slice(0, 120), new Date());
  return Response.json({ id }, { status: 201 });
}
