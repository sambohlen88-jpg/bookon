import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Book links go through /go/<token>, on the site and in alert emails. The
 * token carries the course, slot and club URL, signed so nobody can turn
 * BookOn into a redirect to another site.
 */
/** Where a Book click came from: search results, an alert, a course page or a shared list. */
export type ClickSource = "search" | "alert" | "directory" | "share";
const SOURCES: ClickSource[] = ["search", "alert", "directory", "share"];

export interface ClickTarget {
  courseId: string;
  /** ISO start time, or null for a link to the course rather than a slot. */
  startTime: string | null;
  url: string;
  source: ClickSource;
  /** The alert email this link was in. */
  notificationId?: string | null;
}

const DEV_SECRET = "bookon-local-development-only";

/** The signing key from the environment, or null in production when none is set. */
export function clickSigningKey(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CLICK_SIGNING_SECRET) return env.CLICK_SIGNING_SECRET;
  return env.NODE_ENV === "production" ? null : DEV_SECRET;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createClickToken(target: ClickTarget, key: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      c: target.courseId,
      t: target.startTime,
      u: target.url,
      s: target.source,
      ...(target.notificationId ? { n: target.notificationId } : {}),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/** The target, or null if the token was altered, signed with another key, or malformed. */
export function readClickToken(token: string, key: string | null): ClickTarget | null {
  if (!key) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.c !== "string" || typeof data.u !== "string") return null;
    if (!SOURCES.includes(data.s)) return null;
    if (data.t !== null && typeof data.t !== "string") return null;
    if (data.n !== undefined && typeof data.n !== "string") return null;
    return {
      courseId: data.c,
      startTime: data.t,
      url: data.u,
      source: data.s,
      notificationId: data.n ?? null,
    };
  } catch {
    return null;
  }
}
