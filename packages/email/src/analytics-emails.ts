import { formatPerthDay, percentChange } from "@bookon/core";
import type { WeeklySummary } from "@bookon/db";
import { detailMessage as message } from "./lesson-emails";
import type { EmailMessage } from "./mailer";

/** The admin's Monday summary of last week (Milestone 23). */

const count = (n: number) => Math.round(n).toLocaleString("en-AU");

const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? "" : "s"}`;

function versus(now: number, before: number): string {
  const change = percentChange(now, before);
  if (change === null) return `${count(now)} (none the week before)`;
  if (change === 0) return `${count(now)} (same as the week before)`;
  return `${count(now)} (${change > 0 ? "up" : "down"} ${Math.abs(change)}%)`;
}

export function weeklySummaryEmail(input: {
  to: string;
  summary: WeeklySummary;
  link: string;
}): EmailMessage {
  const s = input.summary;
  const dates = `${formatPerthDay(s.span.from)} to ${formatPerthDay(s.span.to)}`;
  const quiet = s.totals.visitors === 0;
  return message({
    to: input.to,
    subject: `BookOn last week: ${plural(s.totals.visitors, "visitor")}, ${plural(s.clicks, "click")} to clubs`,
    greeting: "Hi,",
    paragraphs: [
      `Here's how BookOn went from ${dates}.`,
      quiet && "Nobody visited last week (your own visits aren't counted).",
      !quiet &&
        `${Math.round(s.clickThrough * 100)}% of visitors went on to a club's booking page.`,
      s.topCourses.length > 0 &&
        `Most clicked courses: ${s.topCourses.map((c) => `${c.name} (${count(c.clicks)})`).join(", ")}.`,
      s.topChannels.length > 0 &&
        `Visits came most from: ${s.topChannels.map((c) => `${c.label} (${count(c.count)})`).join(", ")}.`,
    ],
    details: [
      ["Visitors", versus(s.totals.visitors, s.previous.visitors)],
      ["Visits", versus(s.totals.visits, s.previous.visits)],
      ["Page views", versus(s.totals.views, s.previous.views)],
      ["Searches", versus(s.searches, s.previousSearches)],
      ["Clicks to clubs", versus(s.clicks, s.previousClicks)],
      ["New accounts", count(s.signups)],
      ["Tee time alerts set up", count(s.alerts)],
    ],
    link: { href: input.link, label: "Open Analytics" },
    after: ["You can turn this email off in Admin, Settings."],
  });
}
