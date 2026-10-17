import { cookies, headers } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveGo } from "@/lib/go";
import { SESSION_COOKIE, validSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { location } = await resolveGo(getDb(), token, {
    sessionId: validSessionId((await cookies()).get(SESSION_COOKIE)?.value),
    userId: (await currentUser())?.id ?? null,
    userAgent: (await headers()).get("user-agent"),
    now: new Date(),
  });
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(location, request.url).toString(), "Cache-Control": "no-store" },
  });
}
