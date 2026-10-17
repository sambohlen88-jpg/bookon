import {
  enablePushForAlerts,
  removePushSubscription,
  savePushSubscription,
  validPushEndpoint,
} from "@bookon/db";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Only this site's own pages may call this. The JSON content type already
 * forces a browser check for other sites; the Origin check makes sure.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Save this device for push notifications, and turn push on for the golfer's alerts. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const body = await readJson(request);
  const keys = body?.keys as Record<string, unknown> | undefined;
  const endpoint = body?.endpoint;
  if (
    typeof endpoint !== "string" ||
    !validPushEndpoint(endpoint) ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string" ||
    keys.p256dh.length > 200 ||
    keys.auth.length > 100
  ) {
    return new Response("Not a push subscription", { status: 400 });
  }
  const db = getDb();
  await savePushSubscription(
    db,
    user.id,
    {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      deviceLabel: typeof body?.deviceLabel === "string" ? body.deviceLabel : null,
    },
    new Date(),
  );
  await enablePushForAlerts(db, user.id);
  return new Response(null, { status: 204 });
}

/** Stop push notifications to this device. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const body = await readJson(request);
  if (typeof body?.endpoint !== "string") return new Response("No endpoint", { status: 400 });
  await removePushSubscription(getDb(), user.id, body.endpoint);
  return new Response(null, { status: 204 });
}
