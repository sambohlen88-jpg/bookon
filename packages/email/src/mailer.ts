import { addOutboxEmail, type Database } from "@bookon/db";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export const DEFAULT_FROM = "BookOn <info@bookon.com.au>";

/**
 * Development: keep emails in the database (shown at /dev/outbox) and print
 * them, instead of sending. No email account needed.
 */
export class OutboxMailer implements Mailer {
  constructor(private readonly db: Database) {}

  async send(message: EmailMessage): Promise<void> {
    await addOutboxEmail(this.db, message);
    const firstLink = /https?:\/\/\S+/.exec(message.text)?.[0];
    console.log(
      `[email] to ${message.to}: ${message.subject}${firstLink ? `\n        ${firstLink}` : ""}`,
    );
  }
}

/** Sends through Postmark's API. https://postmarkapp.com/developer/api/email-api */
export class PostmarkMailer implements Mailer {
  constructor(
    private readonly serverToken: string,
    private readonly from = DEFAULT_FROM,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.serverToken,
      },
      body: JSON.stringify({
        From: this.from,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        MessageStream: "outbound",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(
        `Postmark refused the email: HTTP ${response.status} ${await response.text()}`,
      );
    }
  }
}

/**
 * Postmark when `EMAIL_PROVIDER=postmark` and a server token is set,
 * otherwise the development outbox.
 */
export function createMailer(db: Database, env: NodeJS.ProcessEnv = process.env): Mailer {
  if (env.EMAIL_PROVIDER === "postmark") {
    if (!env.POSTMARK_SERVER_TOKEN)
      throw new Error("EMAIL_PROVIDER=postmark needs POSTMARK_SERVER_TOKEN");
    return new PostmarkMailer(env.POSTMARK_SERVER_TOKEN, env.EMAIL_FROM || DEFAULT_FROM);
  }
  if (env.NODE_ENV === "production") {
    console.error(
      "[email] EMAIL_PROVIDER is not postmark, so emails go to the outbox and are not delivered",
    );
  }
  return new OutboxMailer(db);
}

/** The site's own address for links in emails. */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BOOKON_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
