import { addCoachPhoto, coachForEmail } from "@bookon/db";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MAX_UPLOAD_BYTES, preparePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Only BookOn's own pages may upload. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

const reply = (status: number, message: string) => Response.json({ message }, { status });

/** A coach adds a photo of themselves. It shows once BookOn approves it. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply(403, "Not allowed.");
  const user = await currentUser();
  if (!user) return reply(403, "Sign in first.");
  const db = getDb();
  const coach = await coachForEmail(db, user.email);
  if (!coach) return reply(404, "Save your listing first, then add a photo.");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 100_000)
    return reply(413, "That photo is too big. Use one under 15 MB.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "That didn't upload. Try again.");
  }
  const rightsBy = String(form.get("rightsBy") ?? "").trim();
  if (!rightsBy || form.get("rights") !== "yes")
    return reply(400, "Confirm it's your photo to share, and add your name.");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return reply(400, "Choose a photo first.");
  if (file.size > MAX_UPLOAD_BYTES)
    return reply(413, "That photo is too big. Use one under 15 MB.");
  const photo = await preparePhoto(Buffer.from(await file.arrayBuffer()));
  if (!photo) return reply(400, "That file isn't a photo we can use. Try a JPEG or PNG.");
  const result = await addCoachPhoto(db, coach.id, photo, rightsBy.slice(0, 120), new Date());
  if ("error" in result)
    return reply(409, "You have photos waiting for approval. Wait for those first.");
  return Response.json({ id: result.id }, { status: 201 });
}
