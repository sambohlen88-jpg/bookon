import { NextResponse, type NextRequest } from "next/server";
import {
  TESTER_COOKIE,
  TESTER_COOKIE_MAX_AGE_SECONDS,
  hasSitePassword,
  sameText,
  sitePassword,
  testerCode,
  testerCookieValue,
} from "@/lib/private-site";
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
 * (Google reads a 401 there as "anything goes"), the uptime check, Stripe's
 * webhook (it checks Stripe's own signature instead) and Mailchimp's (it checks
 * the secret in its address).
 */
const OPEN_PATHS = new Set([
  "/robots.txt",
  "/api/health",
  "/api/stripe/webhook",
  "/api/mailchimp/webhook",
]);
/** Coaches' calendar links: calendar apps can't type the site password, and the link is private. */
const OPEN_PREFIXES = ["/calendar/"];

export async function middleware(request: NextRequest) {
  // Private test mode: ask for the site password, and keep search engines out.
  const password = sitePassword();
  if (password) {
    // A tester link: let this browser in for 30 days, then drop the code from the address.
    const code = testerCode();
    const given = request.nextUrl.searchParams.get("tester");
    if (code && given !== null) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("tester");
      const response = NextResponse.redirect(url);
      if (sameText(given, code)) {
        response.cookies.set(TESTER_COOKIE, await testerCookieValue(code), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: TESTER_COOKIE_MAX_AGE_SECONDS,
          path: "/",
        });
      }
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
  }
  const tester =
    password !== null &&
    testerCode() !== null &&
    sameText(
      request.cookies.get(TESTER_COOKIE)?.value ?? "",
      await testerCookieValue(testerCode()!),
    );
  if (
    password &&
    !tester &&
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
