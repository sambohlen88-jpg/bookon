import { cookies } from "next/headers";
import { CONTACT_METHODS, liveCoachBySlug, logCoachContact, type ContactMethod } from "@bookon/db";
import { isBot } from "@/lib/bots";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Count a tap on a coach's WhatsApp, email, call or website button, so
 * coaches can see what BookOn sends them. Sent by the page as it opens the
 * link; it never holds the golfer up.
 */
export async function POST(request: Request) {
  let body: { slug?: unknown; method?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const method = body.method as ContactMethod;
  if (typeof body.slug !== "string" || !CONTACT_METHODS.includes(method))
    return new Response(null, { status: 400 });
  if (isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const db = getDb();
  const coach = await liveCoachBySlug(db, body.slug);
  if (!coach) return new Response(null, { status: 404 });
  const sessionId = validSessionId((await cookies()).get(SESSION_COOKIE)?.value);
  await logCoachContact(db, coach.id, method, sessionId, new Date());
  return new Response(null, { status: 204 });
}
