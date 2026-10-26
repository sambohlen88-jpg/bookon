import { timingSafeEqual } from "node:crypto";
import { subscribeNewsletter, unsubscribeNewsletter } from "@bookon/db";
import { readMailchimpWebhook } from "@bookon/email";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Mailchimp tells BookOn when someone unsubscribes, bounces, signs up on a
 * Mailchimp form or changes their address (Milestone 27). Mailchimp doesn't
 * sign webhooks, so the address carries a secret:
 * https://<site>/api/mailchimp/webhook?key=<MAILCHIMP_WEBHOOK_SECRET>
 */
function allowed(request: Request): boolean {
  const secret = process.env.MAILCHIMP_WEBHOOK_SECRET;
  const given = new URL(request.url).searchParams.get("key") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/** Mailchimp checks the address answers before it saves the webhook. */
export async function GET(request: Request) {
  return allowed(request) ? new Response("OK") : new Response("Not found", { status: 404 });
}

export async function POST(request: Request) {
  if (!allowed(request)) return new Response("Not found", { status: 404 });
  const change = readMailchimpWebhook(new URLSearchParams(await request.text()));
  if (!change || change.listId !== process.env.MAILCHIMP_AUDIENCE_ID) return new Response("OK");
  const db = getDb();
  const now = new Date();
  // Each is marked as already in Mailchimp, so the worker doesn't send it back.
  if (change.kind === "subscribed")
    await subscribeNewsletter(db, { email: change.email, source: "mailchimp", now, synced: true });
  else if (change.kind === "unsubscribed")
    await unsubscribeNewsletter(db, { email: change.email, via: "mailchimp", now });
  else {
    await unsubscribeNewsletter(db, { email: change.oldEmail, via: "mailchimp", now });
    await subscribeNewsletter(db, {
      email: change.newEmail,
      source: "mailchimp",
      now,
      synced: true,
    });
  }
  return new Response("OK");
}
