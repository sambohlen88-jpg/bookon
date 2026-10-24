import type { Article } from "@bookon/db";
import { detailMessage as message } from "./lesson-emails";
import type { EmailMessage } from "./mailer";

/** Emails about news articles (Milestone 24), between authors and the admin. */

/** To the admin when an author sends an article in. */
export function articleSubmittedEmail(input: {
  to: string;
  article: Article;
  link: string;
}): EmailMessage {
  const { article } = input;
  return message({
    to: input.to,
    subject: `To approve: ${article.title}`,
    greeting: "Hi,",
    paragraphs: [
      `${article.authorName} has sent in a news article for you to approve.`,
      `"${article.summary}"`,
    ],
    link: { href: input.link, label: "Read and approve" },
  });
}

/** To the author when the admin sends it back with a note. */
export function articleSentBackEmail(input: {
  to: string;
  article: Article;
  link: string;
}): EmailMessage {
  const { article } = input;
  return message({
    to: input.to,
    subject: `Changes to: ${article.title}`,
    greeting: `Hi ${article.authorName},`,
    paragraphs: [
      `Thanks for your article. BookOn has sent it back with a note before it's published.`,
      article.reviewNote && `"${article.reviewNote}"`,
      "Make the changes, then send it in again.",
    ],
    link: { href: input.link, label: "Open your article" },
  });
}

/** To the author when it's published, or scheduled. */
export function articleApprovedEmail(input: {
  to: string;
  article: Article;
  when: string | null;
  link: string;
}): EmailMessage {
  const { article } = input;
  return message({
    to: input.to,
    subject: `${input.when ? "Scheduled" : "Published"}: ${article.title}`,
    greeting: `Hi ${article.authorName},`,
    paragraphs: [
      input.when
        ? `Your article has been approved, and goes live on BookOn News on ${input.when}.`
        : "Your article has been approved, and it's live on BookOn News now. Thanks for writing it!",
      "Share it with your friends and golf groups.",
    ],
    link: { href: input.link, label: input.when ? "See your articles" : "Read it on BookOn" },
  });
}
