import { addOutboxEmail, type Database } from "@bookon/db";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Which address it's from (Milestone 27): tee time alerts come from alerts@, the rest from info@. */
  sender?: "alerts";
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export const DEFAULT_FROM = "BookOn <info@bookon.au>";
export const DEFAULT_ALERTS_FROM = "BookOn alerts <alerts@bookon.au>";

/** Which kind of email a link is from, by where it goes. */
function campaignFor(path: string): string | null {
  // Sign-in links, click-throughs to clubs, calendar files and downloads stay as they are.
  if (/^\/(auth|go|calendar|api|dev)(\/|$)|\.(ics|csv)(\?|$)/.test(path)) return null;
  if (path.startsWith("/alerts")) return "alert";
  if (path.startsWith("/lessons") || path.startsWith("/coach")) return "lesson";
  if (path.startsWith("/sessions")) return "group-session";
  if (path.startsWith("/entries") || path.startsWith("/competitions")) return "event";
  if (path.startsWith("/matchplay")) return "matchplay";
  if (path.startsWith("/club")) return "club";
  return "email";
}

/**
 * Tag links to BookOn's own pages in an email (Milestone 23), so Analytics
 * can count the visits BookOn's emails bring back.
 */
export function tagEmailLinks(message: EmailMessage, site: string): EmailMessage {
  const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const link = new RegExp(`${escaped}(/[^\\s"'<>)]*)?`, "g");
  const tag = (url: string, path = "/") => {
    const campaign = campaignFor(path);
    if (!campaign || /[?&]utm_source=/.test(url)) return url;
    const [base, hash] = url.split("#");
    const join = base!.includes("?") ? "&" : "?";
    return `${base}${join}utm_source=bookon&utm_medium=email&utm_campaign=${campaign}${hash !== undefined ? `#${hash}` : ""}`;
  };
  return {
    ...message,
    text: message.text.replace(link, (url, path) => tag(url, path)),
    html: message.html.replace(link, (url, path) => tag(url, path)),
  };
}

/**
 * Development: keep emails in the database (shown at /dev/outbox) and print
 * them, instead of sending. No email account needed.
 */
export class OutboxMailer implements Mailer {
  constructor(private readonly db: Database) {}

  async send(original: EmailMessage): Promise<void> {
    const message = tagEmailLinks(original, siteUrl());
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
    private readonly alertsFrom = DEFAULT_ALERTS_FROM,
  ) {}

  async send(original: EmailMessage): Promise<void> {
    const message = tagEmailLinks(original, siteUrl());
    const response = await this.fetchImpl("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.serverToken,
      },
      body: JSON.stringify({
        // Alerts come from alerts@, and replies go to info@, where a person reads them.
        ...(message.sender === "alerts"
          ? { From: this.alertsFrom, ReplyTo: this.from }
          : { From: this.from }),
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
    return new PostmarkMailer(
      env.POSTMARK_SERVER_TOKEN,
      env.EMAIL_FROM || DEFAULT_FROM,
      undefined,
      env.EMAIL_ALERTS_FROM || DEFAULT_ALERTS_FROM,
    );
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
