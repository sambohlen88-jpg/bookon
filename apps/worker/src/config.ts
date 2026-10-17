import { LOCAL_DATABASE_URL } from "@bookon/db";

export interface WorkerConfig {
  databaseUrl: string;
  userAgent: string;
  contactEmail: string;
  minRequestIntervalMs: number;
  pollIntervalMinutes: number;
  /** Robots.txt agents obeyed as well as our own. */
  alsoObeyAgents: string[];
}

/** Goes in the user agent so clubs can contact us. */
export const DEFAULT_CONTACT_EMAIL = "info@bookon.com.au";

/** Read worker settings from the environment. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const contact = env.BOOKON_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  const site = env.BOOKON_SITE_URL?.trim() || "https://bookon.com.au";
  return {
    databaseUrl: env.DATABASE_URL?.trim() || LOCAL_DATABASE_URL,
    userAgent: `BookOnBot/0.1 (+${site}; ${contact})`,
    contactEmail: contact,
    minRequestIntervalMs: Number(env.MIN_REQUEST_INTERVAL_MS) || 3000,
    pollIntervalMinutes: Number(env.POLL_INTERVAL_MINUTES) || 30,
    // When Claude Code runs the worker, it is Claude fetching for a user, so obey sites' rules for Claude-User too.
    alsoObeyAgents: env.CLAUDECODE ? ["Claude-User"] : [],
  };
}
