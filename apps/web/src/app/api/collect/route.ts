import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordEvent, recordPageView, recordTimeOnPage, recordVital } from "@bookon/db";
import { visitorKind } from "@/lib/access";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, validSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

const nothing = () => new NextResponse(null, { status: 204 });

function header(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * BookOn's own analytics (Milestone 23): page views, time on page, actions
 * and loading times from the browser. The admin's own visits, bots and
 * browsers asking not to be tracked aren't counted. No IP address is kept;
 * the city comes from the host (Vercel) when it gives one.
 */
export async function POST(request: Request) {
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1")
    return nothing();
  const raw = await request.text();
  if (raw.length > 4000) return nothing();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return nothing();
  }
  const kind = await visitorKind();
  if (kind.admin) return nothing();

  const store = await cookies();
  let visitorId = validSessionId(store.get(SESSION_COOKIE)?.value);
  const fresh = !visitorId;
  visitorId ??= crypto.randomUUID();
  const db = getDb();
  const now = new Date();
  const userAgent = request.headers.get("user-agent");
  let id: string | null = null;

  switch (body.type) {
    case "view": {
      const path = text(body.path, 1000) ?? "/";
      const query = new URLSearchParams(path.split("?")[1] ?? "");
      id = await recordPageView(
        db,
        {
          visitorId,
          path,
          referrer: text(body.referrer, 1000),
          ownHost: request.headers.get("host") ?? new URL(request.url).host,
          utm: {
            source: query.get("utm_source"),
            medium: query.get("utm_medium"),
            campaign: query.get("utm_campaign"),
          },
          userAgent,
          width: num(body.width),
          app: body.app === true,
          signedIn: kind.signedIn,
          country: header(request, "x-vercel-ip-country"),
          region: header(request, "x-vercel-ip-country-region"),
          city: header(request, "x-vercel-ip-city"),
        },
        now,
      );
      break;
    }
    case "leave":
      await recordTimeOnPage(db, text(body.id, 36) ?? "", visitorId, num(body.ms) ?? -1);
      break;
    case "event":
      await recordEvent(
        db,
        {
          visitorId,
          name: text(body.name, 40) ?? "",
          path: text(body.path, 300),
          label: text(body.label, 60),
        },
        now,
      );
      break;
    case "vital":
      await recordVital(
        db,
        {
          name: text(body.name, 10) ?? "",
          value: num(body.value) ?? -1,
          path: text(body.path, 300) ?? "/",
          userAgent,
          width: num(body.width),
        },
        now,
      );
      break;
    default:
      return nothing();
  }

  const response = id ? NextResponse.json({ id }) : nothing();
  if (fresh)
    response.cookies.set(SESSION_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
  return response;
}
