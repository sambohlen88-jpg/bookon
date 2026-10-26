/**
 * Private test mode: while BOOKON_SITE_PASSWORD is set, every page asks for
 * that password (any username) and search engines are told not to index the
 * site. For a hosted test site before launch.
 */
export function sitePassword(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.BOOKON_SITE_PASSWORD?.trim() || null;
}

/** Whether a request's Authorization header has the site password. */
export function hasSitePassword(authorization: string | null, password: string): boolean {
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(authorization ?? "");
  if (!match) return false;
  let decoded: string;
  try {
    decoded = atob(match[1]!);
  } catch {
    return false;
  }
  return sameText(decoded.slice(decoded.indexOf(":") + 1), password);
}

/** The cookie a tester link leaves on a phone or computer (see `testerCode`). */
export const TESTER_COOKIE = "bookon_tester";
/** A tester link lets that browser in for this long. */
export const TESTER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Tester links: while the site is private, `/?tester=<BOOKON_TESTER_CODE>`
 * lets that browser in for 30 days without the password box, so testers can
 * add BookOn to their Home Screen and turn on notifications. Changing the
 * code locks everyone who used the old one out. Off when not set.
 */
export function testerCode(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.BOOKON_TESTER_CODE?.trim() || null;
}

/** What the tester cookie holds: a fingerprint of the code, never the code itself. */
export async function testerCookieValue(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`bookon-tester:${code}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether two strings match, comparing every character so the time taken gives nothing away. */
export function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
