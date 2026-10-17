import { bookingHostsFor, logClick, type Database } from "@bookon/db";
import { isBot } from "./bots";
import { readClickToken } from "./click-token";

export interface GoResult {
  /** Where to send the golfer. "/" when the link can't be trusted. */
  location: string;
  logged: boolean;
}

/**
 * Turn a /go token into a redirect, logging the click. Only ever forwards to
 * the booking site of the course the token names.
 */
export async function resolveGo(
  db: Database,
  token: string,
  visitor: { sessionId: string | null; userAgent: string | null; now: Date },
  key?: string,
): Promise<GoResult> {
  const target = readClickToken(token, key);
  if (!target) return { location: "/", logged: false };

  let url: URL;
  try {
    url = new URL(target.url);
  } catch {
    return { location: "/", logged: false };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { location: "/", logged: false };
  const hosts = await bookingHostsFor(db, target.courseId);
  if (!hosts.includes(url.host)) return { location: "/", logged: false };

  let logged = false;
  if (!isBot(visitor.userAgent)) {
    try {
      logged = await logClick(db, {
        sessionId: visitor.sessionId,
        courseId: target.courseId,
        startTime: target.startTime ? new Date(target.startTime) : null,
        source: target.source,
        now: visitor.now,
      });
    } catch (error) {
      // Never stop a golfer reaching the club because logging failed.
      console.error("[go] could not log click", error);
    }
  }
  return { location: url.toString(), logged };
}
