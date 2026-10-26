/**
 * Mailchimp, for BookOn's newsletter (Milestone 27). BookOn keeps the list
 * and the proof of consent; this copies each person's status to one
 * Mailchimp audience, which is where newsletters are written and sent.
 * https://mailchimp.com/developer/marketing/api/list-members/
 */
import { createHash } from "node:crypto";

export type AudienceStatus = "subscribed" | "unsubscribed";

export interface MarketingList {
  /** Set someone's status, adding them if Mailchimp doesn't have them. */
  setStatus(email: string, status: AudienceStatus, consentedAt: Date): Promise<"done" | "pending">;
}

export class MailchimpAudience implements MarketingList {
  private readonly base: string;

  constructor(
    private readonly apiKey: string,
    private readonly audienceId: string,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    // Keys end in their data centre, like "…-us21".
    const dc = /-([a-z]+\d+)$/.exec(apiKey)?.[1];
    if (!dc) throw new Error("MAILCHIMP_API_KEY doesn't end in a data centre like -us21");
    this.base = `https://${dc}.api.mailchimp.com/3.0`;
  }

  async setStatus(
    email: string,
    status: AudienceStatus,
    consentedAt: Date,
  ): Promise<"done" | "pending"> {
    const response = await this.put(email, status, consentedAt);
    if (response.ok) return "done";
    const body = await response.text();
    // Someone who unsubscribed in Mailchimp can only come back by confirming
    // Mailchimp's own email, so ask Mailchimp to send it.
    if (status === "subscribed" && response.status === 400 && /Compliance State/i.test(body)) {
      const pending = await this.put(email, "pending", consentedAt);
      if (pending.ok) return "pending";
      throw new Error(`Mailchimp: HTTP ${pending.status} ${(await pending.text()).slice(0, 200)}`);
    }
    throw new Error(`Mailchimp: HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  private put(email: string, status: AudienceStatus | "pending", consentedAt: Date) {
    const address = email.toLowerCase();
    const hash = createHash("md5").update(address).digest("hex");
    return this.fetchImpl(`${this.base}/lists/${this.audienceId}/members/${hash}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${Buffer.from(`bookon:${this.apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: address,
        status_if_new: status,
        status,
        ...(status === "unsubscribed" ? {} : { timestamp_opt: consentedAt.toISOString() }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  }
}

/** Mailchimp when MAILCHIMP_API_KEY and MAILCHIMP_AUDIENCE_ID are set, otherwise none. */
export function createMarketingList(env: NodeJS.ProcessEnv = process.env): MarketingList | null {
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_AUDIENCE_ID) return null;
  return new MailchimpAudience(env.MAILCHIMP_API_KEY, env.MAILCHIMP_AUDIENCE_ID);
}

export type MailchimpChange =
  | { kind: "subscribed"; email: string; listId: string }
  | { kind: "unsubscribed"; email: string; listId: string }
  | { kind: "changed-email"; oldEmail: string; newEmail: string; listId: string };

/**
 * A Mailchimp webhook post, as BookOn needs it, or null for ones it ignores.
 * Mailchimp sends form fields like type=unsubscribe and data[email].
 * https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/
 */
export function readMailchimpWebhook(form: URLSearchParams): MailchimpChange | null {
  const listId = form.get("data[list_id]") ?? "";
  const email = (form.get("data[email]") ?? "").trim().toLowerCase();
  switch (form.get("type")) {
    case "subscribe":
      return email ? { kind: "subscribed", email, listId } : null;
    // Unsubscribed, or "cleaned" when the address bounces: either way, stop.
    case "unsubscribe":
    case "cleaned":
      return email ? { kind: "unsubscribed", email, listId } : null;
    case "upemail": {
      const oldEmail = (form.get("data[old_email]") ?? "").trim().toLowerCase();
      const newEmail = (form.get("data[new_email]") ?? "").trim().toLowerCase();
      return oldEmail && newEmail ? { kind: "changed-email", oldEmail, newEmail, listId } : null;
    }
    default:
      return null;
  }
}
