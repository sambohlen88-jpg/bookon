import type { EmailMessage } from "./mailer";
import { SENDER, button, escape, layout } from "./templates";

/** Emails about coach listings (Milestone 12). */

function message(input: {
  to: string;
  subject: string;
  greeting: string;
  paragraphs: (string | null | undefined)[];
  link?: { href: string; label: string };
}): EmailMessage {
  const paragraphs = input.paragraphs.filter((p): p is string => Boolean(p));
  return {
    to: input.to,
    subject: input.subject,
    text: [
      input.greeting,
      "",
      ...paragraphs.flatMap((p) => [p, ""]),
      ...(input.link ? [input.link.href, ""] : []),
      SENDER,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">${escape(input.greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join("\n")}
${input.link ? `<p style="margin:0">${button(input.link.href, input.link.label)}</p>` : ""}`,
      escape(SENDER),
    ),
  };
}

/** To whoever reviews listings: a coach sent a new listing or changes. */
export function coachSubmittedEmail(input: {
  to: string;
  coachName: string;
  coachEmail: string;
  changes: boolean;
  reviewLink: string;
}): EmailMessage {
  const what = input.changes ? "changes to their coaching listing" : "a new coaching listing";
  return message({
    to: input.to,
    subject: `${input.coachName} sent ${input.changes ? "changes" : "a coaching listing"} to check`,
    greeting: "Hi,",
    paragraphs: [
      `${input.coachName} (${input.coachEmail}) sent ${what}. Check their PGA membership, then approve or decline it.`,
    ],
    link: { href: input.reviewLink, label: "Review the listing" },
  });
}

export function coachApprovedEmail(input: {
  to: string;
  name: string;
  firstTime: boolean;
  pageLink: string;
  note?: string | null;
}): EmailMessage {
  return message({
    to: input.to,
    subject: input.firstTime ? "You're on BookOn" : "Your BookOn changes are live",
    greeting: `Hi ${input.name},`,
    paragraphs: [
      input.firstTime
        ? "Good news: your coaching listing is approved and golfers can now find you on BookOn. They'll contact you directly to book."
        : "Your changes are approved and now showing on BookOn.",
      input.note,
      "Keep your teaching hours and days away up to date, so golfers see when you're free.",
    ],
    link: { href: input.pageLink, label: "See your page" },
  });
}

export function coachDeclinedEmail(input: {
  to: string;
  name: string;
  firstTime: boolean;
  portalLink: string;
  note?: string | null;
}): EmailMessage {
  return message({
    to: input.to,
    subject: input.firstTime ? "Your BookOn coaching listing" : "Your BookOn changes",
    greeting: `Hi ${input.name},`,
    paragraphs: [
      input.firstTime
        ? "Thanks for listing your coaching on BookOn. We can't put it live yet."
        : "We couldn't put your latest changes live yet. Your page still shows what it did before.",
      input.note,
      "You can change your listing and send it again. If you have questions, reply to this email or write to info@bookon.com.au.",
    ],
    link: { href: input.portalLink, label: "Open your listing" },
  });
}
