import {
  BOOKON_UID_SUFFIX,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  googleCalendarEventLink,
  perthDate,
  RATE_KIND_NAME,
  type CalendarEvent,
} from "@bookon/core";
import type { LessonBooking } from "@bookon/db";
import type { EmailMessage } from "./mailer";
import { SENDER, button, escape, layout } from "./templates";

/** Emails about booking and paying for lessons (Milestone 15). */

type Lesson = Pick<
  LessonBooking,
  | "rate"
  | "startTime"
  | "place"
  | "golferName"
  | "golferEmail"
  | "golferPhone"
  | "note"
  | "lessonCents"
  | "feeCents"
>;

/**
 * A lesson as a calendar event (Milestone 16): for the coach's calendar
 * feed, or the golfer's "Add to calendar". Waiting requests show as not
 * confirmed. The UID stays the same, so a calendar app updates the event.
 */
export function lessonCalendarEvent(
  lesson: Lesson & Pick<LessonBooking, "id" | "endTime"> & { status?: LessonBooking["status"] },
  options: { for: "coach" | "golfer"; coachName: string; url?: string },
): CalendarEvent {
  const waiting = lesson.status === "requested";
  const coach = options.for === "coach";
  return {
    uid: `lesson-${lesson.id}${BOOKON_UID_SUFFIX}`,
    start: lesson.startTime,
    end: lesson.endTime,
    summary: coach
      ? `${waiting ? "Request (not confirmed)" : "Lesson"}: ${lesson.golferName}, ${lesson.rate.name}`
      : `Golf lesson with ${options.coachName}`,
    description: (coach
      ? [
          `${lessonName(lesson)} with ${lesson.golferName}`,
          `Mobile: ${formatAuPhone(lesson.golferPhone)}`,
          `Email: ${lesson.golferEmail}`,
          lesson.note ? `Note: ${lesson.note}` : null,
          waiting ? "Accept or decline in My coaching on BookOn." : null,
          `Booked through BookOn${options.url ? `: ${options.url}` : ""}`,
        ]
      : [
          `${lessonName(lesson)} with ${options.coachName}`,
          `Booked through BookOn${options.url ? `: ${options.url}` : ""}`,
        ]
    )
      .filter(Boolean)
      .join("\n"),
    location: lesson.place,
    url: options.url,
    status: waiting ? "TENTATIVE" : "CONFIRMED",
  };
}

/** "Sat 24 Oct, 9:00 am". */
export function lessonWhen(start: Date): string {
  return `${formatPerthDay(perthDate(start))}, ${formatPerthTime(start)}`;
}

/** "Private lesson, 60 min". */
export function lessonName(lesson: Pick<LessonBooking, "rate">): string {
  return `${lesson.rate.name}, ${lesson.rate.minutes} min`;
}

function message(input: {
  to: string;
  subject: string;
  greeting: string;
  paragraphs: (string | null | undefined | false)[];
  details?: [string, string | null | undefined][];
  link?: { href: string; label: string };
  /** Smaller links under the button, such as "Add to calendar". */
  links?: { href: string; label: string }[];
  after?: (string | null | undefined | false)[];
}): EmailMessage {
  const clean = (list: (string | null | undefined | false)[] = []) =>
    list.filter((p): p is string => Boolean(p));
  const paragraphs = clean(input.paragraphs);
  const after = clean(input.after);
  const details = (input.details ?? []).filter((d): d is [string, string] => Boolean(d[1]));
  return {
    to: input.to,
    subject: input.subject,
    text: [
      input.greeting,
      "",
      ...paragraphs.flatMap((p) => [p, ""]),
      ...(details.length ? [...details.map(([k, v]) => `${k}: ${v}`), ""] : []),
      ...(input.link ? [`${input.link.label}: ${input.link.href}`, ""] : []),
      ...(input.links ?? []).flatMap((l) => [`${l.label}: ${l.href}`, ""]),
      ...after.flatMap((p) => [p, ""]),
      SENDER,
    ].join("\n"),
    html: layout(
      `<p style="margin:0 0 16px">${escape(input.greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join("\n")}
${
  details.length
    ? `<table style="margin:0 0 16px;border-collapse:collapse;font-size:15px">${details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 12px 2px 0;color:#5b6b62;vertical-align:top">${escape(k)}</td><td style="padding:2px 0">${escape(v)}</td></tr>`,
        )
        .join("")}</table>`
    : ""
}
${input.link ? `<p style="margin:0 0 16px">${button(input.link.href, input.link.label)}</p>` : ""}
${
  input.links?.length
    ? `<p style="margin:0 0 16px;font-size:15px">${input.links
        .map((l) => `<a href="${escape(l.href)}" style="color:#1f6f43">${escape(l.label)}</a>`)
        .join(" &middot; ")}</p>`
    : ""
}
${after.map((p) => `<p style="margin:0 0 16px;font-size:14px;color:#5b6b62">${escape(p)}</p>`).join("\n")}`,
      escape(SENDER),
    ),
  };
}

function lessonDetails(lesson: Lesson, coachName: string): [string, string][] {
  return [
    ["Lesson", lessonName(lesson)],
    ["Coach", coachName],
    ["When", lessonWhen(lesson.startTime)],
    ["Where", lesson.place],
  ];
}

function money(lesson: Lesson): [string, string][] {
  return [
    [
      lesson.rate.charged
        ? `Lesson (${RATE_KIND_NAME[lesson.rate.charged].toLowerCase()})`
        : "Lesson",
      formatPrice(lesson.lessonCents),
    ],
    ["Booking fee", formatPrice(lesson.feeCents)],
    ["Total", formatPrice(lesson.lessonCents + lesson.feeCents)],
  ];
}

const CANCEL_RULE =
  "You can cancel for a full refund up to 24 hours before the lesson. After that, it can't be refunded.";

/** To the golfer, once their card is held. */
export function lessonRequestedEmail(input: {
  lesson: Lesson;
  coachName: string;
  respondBy: Date;
  manageLink: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: lesson.golferEmail,
    subject: `Lesson request sent to ${input.coachName}`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `Thanks! We've sent your request to ${input.coachName}. ${formatPrice(lesson.lessonCents + lesson.feeCents)} is held on your card but not charged.`,
      `${input.coachName} will accept or decline by ${lessonWhen(input.respondBy)}. If they accept, your card is charged and we'll email to confirm. If not, the hold is released and you won't pay anything.`,
    ],
    details: [
      ...lessonDetails(lesson, input.coachName),
      ["Held on your card", formatPrice(lesson.lessonCents + lesson.feeCents)],
    ],
    link: { href: input.manageLink, label: "See or cancel your booking" },
  });
}

/** To the coach: a new request to accept or decline. */
export function lessonRequestCoachEmail(input: {
  to: string;
  lesson: Lesson;
  coachName: string;
  respondBy: Date;
  portalLink: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: input.to,
    subject: `Lesson request: ${lesson.golferName}, ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${lesson.golferName} would like a lesson with you and has paid. The money is held on their card until you answer.`,
      `Please accept or decline by ${lessonWhen(input.respondBy)}. If you don't, the request lapses and their card is released.`,
    ],
    details: [
      ["Lesson", lessonName(lesson)],
      ["When", lessonWhen(lesson.startTime)],
      ["Where", lesson.place],
      ["Golfer", lesson.golferName],
      ["Mobile", formatAuPhone(lesson.golferPhone)],
      ["Email", lesson.golferEmail],
      ["Their note", lesson.note],
      ["You'll be paid", formatPrice(lesson.lessonCents)],
    ],
    link: { href: input.portalLink, label: "Accept or decline" },
  });
}

/** To the golfer: the coach accepted and the card was charged. */
export function lessonConfirmedEmail(input: {
  lesson: Lesson & Pick<LessonBooking, "id" | "endTime">;
  coachName: string;
  coachContact: { phone?: string; email?: string };
  manageLink: string;
}): EmailMessage {
  const { lesson } = input;
  const event = lessonCalendarEvent(lesson, {
    for: "golfer",
    coachName: input.coachName,
    url: input.manageLink,
  });
  return message({
    to: lesson.golferEmail,
    subject: `Booked: ${lessonName(lesson)} with ${input.coachName}, ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `You're booked in. ${input.coachName} accepted your lesson and your card has been charged.`,
    ],
    details: [
      ...lessonDetails(lesson, input.coachName),
      ...money(lesson),
      ["Coach's phone", input.coachContact.phone ? formatAuPhone(input.coachContact.phone) : null],
      ["Coach's email", input.coachContact.email],
    ],
    link: { href: input.manageLink, label: "See or cancel your booking" },
    links: [
      { href: `${input.manageLink}/calendar.ics`, label: "Add to Apple or Outlook calendar" },
      { href: googleCalendarEventLink(event), label: "Add to Google Calendar" },
    ],
    after: [CANCEL_RULE, "Your receipt comes from Stripe, who handles payments for BookOn."],
  });
}

/** To the golfer: the coach said no. */
export function lessonDeclinedEmail(input: {
  lesson: Lesson;
  coachName: string;
  note: string | null;
  coachPage: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: lesson.golferEmail,
    subject: `${input.coachName} can't do ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `Sorry, ${input.coachName} can't take your lesson at ${lessonWhen(lesson.startTime)}. The hold on your card has been released, so you haven't been charged.`,
      input.note && `${input.coachName} says: "${input.note}"`,
      "Your bank may take a few days to show the hold has gone.",
    ],
    link: { href: input.coachPage, label: "Pick another time" },
  });
}

/** To the golfer: the coach didn't answer in time. */
export function lessonLapsedEmail(input: {
  lesson: Lesson;
  coachName: string;
  coachPage: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: lesson.golferEmail,
    subject: `Your lesson request to ${input.coachName} has lapsed`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `${input.coachName} didn't answer your request for ${lessonWhen(lesson.startTime)} in time, so we've released the hold on your card. You haven't been charged.`,
      "Your bank may take a few days to show the hold has gone. You're welcome to try another time, or message the coach directly.",
    ],
    link: { href: input.coachPage, label: "Pick another time" },
  });
}

/** To the coach: a request lapsed. */
export function lessonLapsedCoachEmail(input: {
  to: string;
  lesson: Lesson;
  coachName: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: input.to,
    subject: `Lesson request lapsed: ${lesson.golferName}, ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${lesson.golferName}'s request for ${lessonWhen(lesson.startTime)} wasn't answered in time, so it lapsed and their card was released.`,
      "If you'd still like to teach them, ask them to book again. If you can't keep up with requests, you can turn bookings off in My coaching.",
    ],
  });
}

/** To the golfer, after they cancel. */
export function lessonCancelledEmail(input: {
  lesson: Lesson;
  coachName: string;
  refundCents: number;
  wasCharged: boolean;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: lesson.golferEmail,
    subject: `Lesson cancelled: ${lessonWhen(lesson.startTime)} with ${input.coachName}`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `Your lesson with ${input.coachName} at ${lessonWhen(lesson.startTime)} is cancelled.`,
      !input.wasCharged
        ? "The hold on your card has been released, so you haven't been charged."
        : input.refundCents > 0
          ? `We've refunded ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`
          : "As it was cancelled less than 24 hours before, it isn't refunded.",
    ],
  });
}

/** To the coach, when the golfer cancels. */
export function lessonCancelledCoachEmail(input: {
  to: string;
  lesson: Lesson;
  coachName: string;
  refunded: boolean;
  wasConfirmed: boolean;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: input.to,
    subject: `${lesson.golferName} cancelled ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      input.wasConfirmed
        ? `${lesson.golferName} cancelled their lesson at ${lessonWhen(lesson.startTime)}. The time is free again on BookOn.`
        : `${lesson.golferName} withdrew their request for ${lessonWhen(lesson.startTime)}. There's nothing for you to do.`,
      input.wasConfirmed &&
        (input.refunded
          ? "They cancelled 24 hours or more before, so they were refunded and the payment to you is reversed."
          : `They cancelled less than 24 hours before, so you keep the ${formatPrice(lesson.lessonCents)}.`),
    ],
  });
}

/** To the golfer, when the coach cancels a booked lesson. */
export function lessonCancelledByCoachEmail(input: {
  lesson: Lesson;
  coachName: string;
  note: string | null;
  refundCents: number;
  coachPage: string;
}): EmailMessage {
  const { lesson } = input;
  return message({
    to: lesson.golferEmail,
    subject: `${input.coachName} cancelled your lesson on ${lessonWhen(lesson.startTime)}`,
    greeting: `Hi ${lesson.golferName},`,
    paragraphs: [
      `Sorry, ${input.coachName} had to cancel your lesson at ${lessonWhen(lesson.startTime)}.`,
      input.note && `${input.coachName} says: "${input.note}"`,
      `We've refunded the full ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`,
    ],
    link: { href: input.coachPage, label: "Book another time" },
  });
}

/** The same email layout, for group sessions. */
export { message as detailMessage };
