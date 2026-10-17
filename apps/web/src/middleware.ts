import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, validSessionId } from "@/lib/session";

/** Give each visitor an anonymous id, visible to the page on their very first request. */
export function middleware(request: NextRequest) {
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
  matcher: ["/", "/search", "/go/:path*"],
};
