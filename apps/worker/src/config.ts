import { LOCAL_DATABASE_URL } from "@bookon/db";

export interface WorkerConfig {
  databaseUrl: string;
  userAgent: string;
  minRequestIntervalMs: number;
  pollIntervalMinutes: number;
}

/** Read worker settings from the environment. Live fetching needs a contact email in the user agent. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const contact = env.BOOKON_CONTACT_EMAIL?.trim();
  if (!contact) {
    throw new Error(
      "Set BOOKON_CONTACT_EMAIL so clubs can identify and contact us from our user agent.",
    );
  }
  const site = env.BOOKON_SITE_URL?.trim() || "https://bookon.com.au";
  return {
    databaseUrl: env.DATABASE_URL?.trim() || LOCAL_DATABASE_URL,
    userAgent: `BookOnBot/0.1 (+${site}; ${contact})`,
    minRequestIntervalMs: Number(env.MIN_REQUEST_INTERVAL_MS) || 3000,
    pollIntervalMinutes: Number(env.POLL_INTERVAL_MINUTES) || 30,
  };
}
