import {
  eachPerthDate,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
  perthToUtc,
} from "@bookon/core";
import type { AlertMatch, SearchParams } from "@bookon/db";
import type { EmailMessage } from "./mailer";

/** The sender details every BookOn email ends with (Spam Act 2003: identify the sender). */
export const SENDER = "BookOn · Perth, Western Australia · info@bookon.au";

export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function layout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#14211a">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:700;color:#1f6f43;margin:0 0 16px">BookOn</p>
<div style="background:#fff;border-radius:12px;padding:20px">${body}</div>
<p style="font-size:12px;color:#5b6b62;line-height:1.5;margin:16px 4px">${footer}</p>
</div></body></html>`;
}

export function button(href: string, label: string): string {
  return `<a href="${escape(href)}" style="display:inline-block;background:#1f6f43;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escape(label)}</a>`;
}

export function signInEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: "Your BookOn sign-in link",
    text: [
      "Here's your link to sign in to BookOn:",
      "",
      link,
      "",
      "It works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.",
      "",
      SENDER,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">Here's your link to sign in to BookOn.</p>
<p style="margin:0 0 16px">${button(link, "Sign in to BookOn")}</p>
<p style="margin:0;font-size:14px;color:#5b6b62">It works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
      escape(SENDER),
    ),
  };
}

/** "Sun 18 Oct · 6:00 am to 12:00 pm · 2 players · 18 holes". */
export function describeSearch(params: SearchParams): string {
  const days =
    params.dateFrom === params.dateTo
      ? formatPerthDay(params.dateFrom)
      : `${formatPerthDay(params.dateFrom)} to ${formatPerthDay(params.dateTo)}`;
  const anyTime = params.timeFrom === "05:00" && params.timeTo === "20:00";
  const time = anyTime
    ? "any time"
    : `${formatPerthTime(perthToUtc("2026-01-01", params.timeFrom))} to ${formatPerthTime(perthToUtc("2026-01-01", params.timeTo))}`;
  const players = `${params.players} ${params.players === 1 ? "player" : "players"}`;
  const holes = params.holes ? `${params.holes} holes` : "9 or 18 holes";
  return `${days} · ${time} · ${players} · ${holes}`;
}

/** Slots listed in one email. The rest are behind "see all". */
const MAX_LISTED = 20;

export interface AlertEmailInput {
  to: string;
  filters: SearchParams;
  /** Each match with its tracked /go link. */
  matches: (AlertMatch & { href: string })[];
  searchUrl: string;
  manageUrl: string;
}

export function alertEmail(input: AlertEmailInput): EmailMessage {
  const { matches } = input;
  const courseNames = [...new Set(matches.map((m) => m.course.name))];
  const subject =
    matches.length === 1
      ? `New tee time: ${courseNames[0]}, ${formatPerthDay(perthDate(matches[0]!.teeTime.startTime))} ${formatPerthTime(matches[0]!.teeTime.startTime)}`
      : `${matches.length} new tee times at ${courseNames.length === 1 ? courseNames[0] : `${courseNames.length} courses`}`;

  const listed = matches.slice(0, MAX_LISTED);
  const more = matches.length - listed.length;
  const line = (m: AlertMatch) => {
    const t = m.teeTime;
    const price = t.priceCents === null ? "price at club" : formatPrice(t.priceCents);
    return `${formatPerthDay(perthDate(t.startTime))} ${formatPerthTime(t.startTime)} · ${m.course.name} · ${t.holes} holes · ${t.spotsAvailable} ${t.spotsAvailable === 1 ? "spot" : "spots"} · ${price}`;
  };

  const footerText = [
    "You're getting this because you set up a BookOn alert for:",
    describeSearch(input.filters),
    `Pause or stop this alert: ${input.manageUrl}`,
    "",
    SENDER,
  ].join("\n");

  return {
    to: input.to,
    subject,
    text: [
      "New tee times match your alert. Book quickly: they go fast.",
      "",
      ...listed.flatMap((m) => [line(m), `Book: ${m.href}`, ""]),
      ...(more > 0
        ? [`And ${more} more: ${input.searchUrl}`, ""]
        : [`See them all: ${input.searchUrl}`, ""]),
      footerText,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">New tee times match your alert. Book quickly: they go fast.</p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${listed
  .map(
    (
      m,
    ) => `<tr><td style="padding:10px 0;border-top:1px solid #d9e2dc;font-size:14px">${escape(line(m))}</td>
<td style="padding:10px 0 10px 12px;border-top:1px solid #d9e2dc;text-align:right"><a href="${escape(m.href)}" style="color:#1f6f43;font-weight:600">Book</a></td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:16px 0 0">${button(input.searchUrl, more > 0 ? `See all ${matches.length} times` : "See them on BookOn")}</p>`,
      `You're getting this because you set up a BookOn alert for ${escape(describeSearch(input.filters))}.<br>
<a href="${escape(input.manageUrl)}" style="color:#5b6b62">Pause or stop this alert</a><br>${escape(SENDER)}`,
    ),
    sender: "alerts",
  };
}

/** The /search link for an alert's filters, so "see all" opens the same search. */
export function searchUrlFor(site: string, params: SearchParams): string {
  const span = eachPerthDate(params.dateFrom, params.dateTo).length;
  const days = [1, 3, 7, 14].find((d) => d >= span) ?? 14;
  const query = new URLSearchParams({
    date: params.dateFrom,
    days: String(days),
    from: params.timeFrom,
    to: params.timeTo,
    players: String(params.players),
    holes: params.holes ? String(params.holes) : "any",
  });
  for (const slug of params.courseSlugs ?? []) query.append("course", slug);
  return `${site}/search?${query}`;
}
