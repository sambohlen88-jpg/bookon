import { NextResponse, type NextRequest } from "next/server";
import { hasSitePassword, sitePassword } from "@/lib/private-site";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, validSessionId } from "@/lib/session";

/**
 * Pages that give each visitor an anonymous id, visible to the page on their
 * very first request: every page, so a new visitor's first page views
 * (analytics, Milestone 23) all carry the same id. Not API calls or files.
 */
function sessionPath(pathname: string): boolean {
  return !pathname.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(pathname);
}

/**
 * Open even in private test mode: robots.txt so crawlers can read "keep out"
 * (Google reads a 401 there as "anything goes"), the uptime check, and Stripe's
 * webhook (it checks Stripe's own signature instead).
 */
const OPEN_PATHS = new Set(["/robots.txt", "/api/health", "/api/stripe/webhook"]);
/** Coaches' calendar links: calendar apps can't type the site password, and the link is private. */
const OPEN_PREFIXES = ["/calendar/"];

export function middleware(request: NextRequest) {
  // Private test mode: ask for the site password, and keep search engines out.
  const password = sitePassword();
  if (
    password &&
    !OPEN_PATHS.has(request.nextUrl.pathname) &&
    !OPEN_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p)) &&
    !hasSitePassword(request.headers.get("authorization"), password)
  ) {
    return new NextResponse("BookOn is a private test site for now.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="BookOn test site", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  const response = session(request);
  if (password) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function session(request: NextRequest): NextResponse {
  if (!sessionPath(request.nextUrl.pathname)) return NextResponse.next();
  if (validSessionId(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const id = crypto.randomUUID();
  request.cookies.set(SESSION_COOKIE, id);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  // Everything but Next's own files, so private test mode covers the whole site.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
