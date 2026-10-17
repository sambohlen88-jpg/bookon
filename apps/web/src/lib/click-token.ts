import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Book links go through /go/<token>. The token carries the course, slot and
 * club URL, signed so nobody can turn BookOn into a redirect to another site.
 */
export interface ClickTarget {
  courseId: string;
  /** ISO start time, or null for a link to the course rather than a slot. */
  startTime: string | null;
  url: string;
  source: "search" | "alert" | "directory";
}

const DEV_SECRET = "bookon-local-development-only";

/** The signing key, or null in production when none is configured (tracking is then off). */
function secret(): string | null {
  const value = process.env.CLICK_SIGNING_SECRET;
  if (value) return value;
  return process.env.NODE_ENV === "production" ? null : DEV_SECRET;
}

let warned = false;

/**
 * The link for a Book button: tracked through /go when a key is configured.
 * Without one in production, golfers still reach the club, just untracked.
 */
export function bookLink(target: ClickTarget, key = secret()): string {
  if (!key) {
    if (!warned)
      console.error("[go] CLICK_SIGNING_SECRET is not set, so Book clicks are not tracked");
    warned = true;
    return target.url;
  }
  return `/go/${createClickToken(target, key)}`;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createClickToken(target: ClickTarget, key: string): string {
  const payload = Buffer.from(
    JSON.stringify({ c: target.courseId, t: target.startTime, u: target.url, s: target.source }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/** The target, or null if the token was altered, signed with another key, or malformed. */
export function readClickToken(token: string, key = secret()): ClickTarget | null {
  if (!key) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.c !== "string" || typeof data.u !== "string") return null;
    if (!["search", "alert", "directory"].includes(data.s)) return null;
    if (data.t !== null && typeof data.t !== "string") return null;
    return { courseId: data.c, startTime: data.t, url: data.u, source: data.s };
  } catch {
    return null;
  }
}
