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
  const given = decoded.slice(decoded.indexOf(":") + 1);
  // Compare every character, so the time taken doesn't hint at how much matched.
  let diff = given.length ^ password.length;
  for (let i = 0; i < Math.max(given.length, password.length); i++)
    diff |= (given.charCodeAt(i) || 0) ^ (password.charCodeAt(i) || 0);
  return diff === 0;
}
