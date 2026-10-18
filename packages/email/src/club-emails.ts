import { formatPrice } from "@bookon/core";
import {
  BOOKING_SYSTEMS,
  CLUB_KINDS,
  CONSENTS,
  FACILITIES,
  type ClubApplication,
  type ClubApplicationDetails,
  type ClubRate,
  type ConsentKey,
  type ConsentRecord,
} from "@bookon/db";
import type { EmailMessage } from "./mailer";
import { SENDER, button, escape, layout } from "./templates";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS = {
  any: "Any day",
  weekday: "Midweek (Mon–Fri)",
  weekend: "Weekends",
  public_holiday: "Public holidays",
  custom: "",
} as const;
const PLAYERS = {
  any: "",
  adult: "Adult",
  senior: "Senior",
  concession: "Concession",
  junior: "Junior",
  student: "Student",
  member_guest: "Member's guest",
} as const;
const UNITS = {
  per_player: "per player",
  per_cart: "per cart",
  per_set: "per set",
  per_group: "per group",
  per_item: "each",
} as const;

/** "1 Nov 2026" for a calendar date. */
function day(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "18 holes · Midweek (Mon–Fri) · Adult · from 3:00 pm · $42 per player". */
export function describeRate(
  rate: Pick<
    ClubRate,
    | "holes"
    | "days"
    | "daysOfWeek"
    | "timeFrom"
    | "timeTo"
    | "player"
    | "priceCents"
    | "unit"
    | "validFrom"
    | "validTo"
    | "courseName"
  >,
): string {
  const time = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "am" : "pm"}`;
  };
  const parts = [
    rate.courseName,
    rate.holes ? `${rate.holes} holes` : null,
    rate.days === "custom"
      ? (rate.daysOfWeek ?? []).map((d) => DAY_NAMES[d - 1]).join(", ")
      : DAYS[rate.days],
    PLAYERS[rate.player] || null,
    rate.timeFrom && rate.timeTo
      ? `${time(rate.timeFrom.slice(0, 5))} to ${time(rate.timeTo.slice(0, 5))}`
      : rate.timeFrom
        ? `from ${time(rate.timeFrom.slice(0, 5))}`
        : rate.timeTo
          ? `until ${time(rate.timeTo.slice(0, 5))}`
          : null,
    rate.validFrom || rate.validTo
      ? `${rate.validFrom ? day(rate.validFrom) : "now"} to ${rate.validTo ? day(rate.validTo) : "ongoing"}`
      : null,
    `${formatPrice(rate.priceCents)} ${UNITS[rate.unit]}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** The whole application as plain text, for BookOn's review email. */
export function clubApplicationText(
  application: ClubApplication,
  rates: ClubRate[],
  photoCount: number,
): string {
  const d = application.details as ClubApplicationDetails;
  const consents = application.consents as Partial<Record<ConsentKey, ConsentRecord>>;
  const person = (p?: { name: string; role?: string; email: string; phone?: string }) =>
    p ? [p.name, p.role, p.email, p.phone].filter(Boolean).join(", ") : "—";
  const t = d.teeTimes;
  const lines = [
    `CLUB: ${d.club?.name ?? application.clubName}`,
    d.club?.legalName ? `Legal name: ${d.club.legalName}` : null,
    d.club?.abn ? `ABN: ${d.club.abn}` : null,
    d.club?.kind ? `Type: ${CLUB_KINDS[d.club.kind]}` : null,
    `Address: ${[d.club?.street, d.club?.suburb, d.club?.state, d.club?.postcode].filter(Boolean).join(", ")}`,
    d.club?.website ? `Website: ${d.club.website}` : null,
    d.club?.phone ? `Phone: ${d.club.phone}` : null,
    "",
    "CONTACTS",
    `Main: ${person(d.contacts?.main)}`,
    d.contacts?.bookings ? `Bookings: ${person(d.contacts.bookings)}` : null,
    d.contacts?.accounts ? `Accounts: ${person(d.contacts.accounts)}` : null,
    d.contacts?.reportsEmail ? `Reports to: ${d.contacts.reportsEmail}` : null,
    "",
    "COURSES",
    ...(d.courses ?? []).map(
      (c) =>
        `${c.name}: ${c.holes} holes${c.par ? `, par ${c.par}` : ""}${c.layouts ? ` (${c.layouts})` : ""}`,
    ),
    "",
    "TEE TIMES",
    t
      ? `Booking system: ${BOOKING_SYSTEMS[t.bookingSystem]}${t.bookingSystemOther ? ` (${t.bookingSystemOther})` : ""}`
      : "—",
    t?.bookingUrl ? `Booking page: ${t.bookingUrl}` : null,
    t?.intervalMinutes ? `Interval: ${t.intervalMinutes} minutes` : null,
    t?.weekdayFirst || t?.weekdayLast
      ? `Weekdays: ${t.weekdayFirst ?? "?"} to ${t.weekdayLast ?? "?"}`
      : null,
    t?.weekendFirst || t?.weekendLast
      ? `Weekends: ${t.weekendFirst ?? "?"} to ${t.weekendLast ?? "?"}`
      : null,
    t?.windowDays ? `Bookable ${t.windowDays} days ahead` : null,
    t?.twoTeeStarts !== undefined ? `Two-tee starts: ${t.twoTeeStarts ? "yes" : "no"}` : null,
    t?.maxPlayers ? `Up to ${t.maxPlayers} players` : null,
    t?.singlesWelcome !== undefined ? `Singles welcome: ${t.singlesWelcome ? "yes" : "no"}` : null,
    t?.memberTimes ? `Not open to the public: ${t.memberTimes}` : null,
    t?.cancellationPolicy ? `Cancellations: ${t.cancellationPolicy}` : null,
    t?.dressCode ? `Dress code: ${t.dressCode}` : null,
    "",
    `PRICES (${rates.length})`,
    ...rates.map(
      (r) =>
        `${r.name}: ${describeRate(r)}${r.gstIncluded ? "" : " + GST"}${r.notes ? ` (${r.notes})` : ""}`,
    ),
    "",
    "FACILITIES",
    (d.extras?.facilities ?? []).map((f) => FACILITIES[f]).join(", ") || "—",
    d.extras?.description ? `About: ${d.extras.description}` : null,
    `Photos: ${photoCount}`,
    "",
    "APPROVALS",
    ...(Object.keys(CONSENTS) as ConsentKey[]).map(
      (k) =>
        `${consents[k]?.accepted ? "[yes]" : "[no] "} ${CONSENTS[k].text}${consents[k]?.accepted ? ` (${consents[k]!.by}, ${consents[k]!.at})` : ""}`,
    ),
    `Interested in taking payments through BookOn: ${application.paymentsInterest ?? "not answered"}`,
    d.payments?.gstRegistered !== undefined
      ? `Registered for GST: ${d.payments.gstRegistered ? "yes" : "no"}`
      : null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** The private link to carry on, sent when a club starts. */
export function clubLinkEmail(input: {
  to: string;
  name: string;
  clubName: string;
  link: string;
}): EmailMessage {
  const intro = `Thanks for listing ${input.clubName} on BookOn. Use this link to carry on where you left off. Anyone with it can edit your listing, so share it only with your team.`;
  return {
    to: input.to,
    subject: `Your BookOn listing for ${input.clubName}`,
    text: [`Hi ${input.name},`, "", intro, "", input.link, "", SENDER].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escape(input.name)},</p>
<p style="margin:0 0 16px">${escape(intro)}</p>
<p style="margin:0">${button(input.link, "Carry on with your listing")}</p>`,
      escape(SENDER),
    ),
  };
}

/** To the club, once they've sent it. */
export function clubSubmittedEmail(input: {
  to: string;
  name: string;
  clubName: string;
  link: string;
}): EmailMessage {
  const body = `We've got the details for ${input.clubName}. We'll check them, set up your tee times, and email you when your club is live on BookOn, usually within a week. You can see what you sent at any time with this link.`;
  return {
    to: input.to,
    subject: `We've got your BookOn listing for ${input.clubName}`,
    text: [`Hi ${input.name},`, "", body, "", input.link, "", SENDER].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escape(input.name)},</p>
<p style="margin:0 0 16px">${escape(body)}</p>
<p style="margin:0">${button(input.link, "See your listing")}</p>`,
      escape(SENDER),
    ),
  };
}

/** To BookOn: a club is waiting for review, with everything they sent. */
export function clubApplicationNotice(input: {
  to: string;
  application: ClubApplication;
  rates: ClubRate[];
  photoCount: number;
}): EmailMessage {
  const summary = clubApplicationText(input.application, input.rates, input.photoCount);
  const next = `Review it with: pnpm clubs show ${input.application.id}`;
  return {
    to: input.to,
    subject: `New club listing: ${input.application.clubName}`,
    text: [summary, "", next].join("\n"),
    html: layout(
      `<pre style="margin:0;white-space:pre-wrap;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif">${escape(summary)}</pre>
<p style="margin:16px 0 0;font-size:14px;color:#5b6b62">${escape(next)}</p>`,
      escape(SENDER),
    ),
  };
}

/** To the club: their listing is approved, and how to sign in to manage it. */
export function clubApprovedEmail(input: {
  to: string;
  name: string;
  clubName: string;
  signInLink: string;
  note?: string | null;
}): EmailMessage {
  const body = `Good news: ${input.clubName} is approved on BookOn. We're setting up your tee times now and will let you know when they're live. In the meantime you can sign in with this email address to update your details, prices and photos, and add your team.`;
  return {
    to: input.to,
    subject: `${input.clubName} is approved on BookOn`,
    text: [
      `Hi ${input.name},`,
      "",
      body,
      ...(input.note ? ["", input.note] : []),
      "",
      input.signInLink,
      "",
      SENDER,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escape(input.name)},</p>
<p style="margin:0 0 16px">${escape(body)}</p>
${input.note ? `<p style="margin:0 0 16px">${escape(input.note)}</p>` : ""}
<p style="margin:0">${button(input.signInLink, "Sign in to your club")}</p>`,
      escape(SENDER),
    ),
  };
}

/** To the club: we can't list them, and why. */
export function clubDeclinedEmail(input: {
  to: string;
  name: string;
  clubName: string;
  note?: string | null;
}): EmailMessage {
  const body = `Thanks for your interest in listing ${input.clubName} on BookOn. We can't list it right now.`;
  const after =
    "If you have questions, or things change, reply to this email or write to info@bookon.com.au.";
  return {
    to: input.to,
    subject: `Your BookOn listing for ${input.clubName}`,
    text: [
      `Hi ${input.name},`,
      "",
      body,
      ...(input.note ? ["", input.note] : []),
      "",
      after,
      "",
      SENDER,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">Hi ${escape(input.name)},</p>
<p style="margin:0 0 16px">${escape(body)}</p>
${input.note ? `<p style="margin:0 0 16px">${escape(input.note)}</p>` : ""}
<p style="margin:0">${escape(after)}</p>`,
      escape(SENDER),
    ),
  };
}

/** Someone was added to a club's login. */
export function clubInviteEmail(input: {
  to: string;
  clubName: string;
  invitedBy: string;
  role: "owner" | "staff";
  signInLink: string;
}): EmailMessage {
  const body = `${input.invitedBy} has added you to ${input.clubName} on BookOn${input.role === "owner" ? " as an owner" : ""}. Sign in with this email address to update the club's details, prices and photos, and see how many golfers BookOn sends you.`;
  return {
    to: input.to,
    subject: `You've been added to ${input.clubName} on BookOn`,
    text: [body, "", input.signInLink, "", SENDER].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">${escape(body)}</p>
<p style="margin:0">${button(input.signInLink, "Sign in to BookOn")}</p>`,
      escape(SENDER),
    ),
  };
}
