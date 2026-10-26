import "server-only";
import { headers } from "next/headers";

/**
 * This site's address, for links in emails. In production it comes from
 * BOOKON_SITE_URL, never the request, so a forged Host header can't put
 * another site's address in an email. Locally it's wherever the site is
 * running, even if BOOKON_SITE_URL was copied from .env.example.
 */
export async function siteOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.BOOKON_SITE_URL) throw new Error("BOOKON_SITE_URL must be set in production");
    return process.env.BOOKON_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

/** BookOn's own inbox, for notices such as a new club listing. */
export function ownerEmail(): string {
  return process.env.BOOKON_OWNER_EMAIL || process.env.BOOKON_CONTACT_EMAIL || "info@bookon.au";
}
