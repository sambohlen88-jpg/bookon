import {
  BOOKON_UID_SUFFIX,
  formatAuPhone,
  formatPrice,
  googleCalendarEventLink,
  type CalendarEvent,
} from "@bookon/core";
import type { GroupBooking, GroupSession } from "@bookon/db";
import { detailMessage as message, lessonWhen } from "./lesson-emails";
import type { EmailMessage } from "./mailer";

/** Emails about group sessions (Milestone 19). */

type Session = Pick<
  GroupSession,
  "id" | "title" | "startTime" | "endTime" | "place" | "priceCents" | "minSpots" | "goingAheadAt"
>;
type Booking = Pick<
  GroupBooking,
  "golferName" | "golferEmail" | "golferPhone" | "note" | "spots" | "spotsCents" | "feeCents"
>;

function spotsText(n: number): string {
  return `${n} ${n === 1 ? "spot" : "spots"}`;
}

function sessionMinutes(session: Session): number {
  return Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60_000);
}

/**
 * A session as a calendar event. For the coach's feed it lists who's coming;
 * for a golfer it's their own booking. The UID stays the same, so a calendar
 * app updates the event as people book.
 */
export function groupCalendarEvent(
  session: Session,
  options:
    | { for: "coach"; bookings: Booking[]; url?: string }
    | { for: "golfer"; coachName: string; spots: number; url?: string },
): CalendarEvent {
  if (options.for === "coach") {
    const booked = options.bookings.reduce((n, b) => n + b.spots, 0);
    return {
      uid: `group-${session.id}${BOOKON_UID_SUFFIX}`,
      start: session.startTime,
      end: session.endTime,
      summary: `Group: ${session.title} (${booked} booked)`,
      description: [
        options.bookings.length
          ? options.bookings
              .map(
                (b) =>
                  `${b.golferName} (${spotsText(b.spots)}), ${formatAuPhone(b.golferPhone)}${b.note ? `: ${b.note}` : ""}`,
              )
              .join("\n")
          : "Nobody booked yet.",
        `Booked through BookOn${options.url ? `: ${options.url}` : ""}`,
      ].join("\n"),
      location: session.place,
      url: options.url,
      status: "CONFIRMED",
    };
  }
  return {
    uid: `group-${session.id}${BOOKON_UID_SUFFIX}`,
    start: session.startTime,
    end: session.endTime,
    summary: `${session.title} with ${options.coachName}`,
    description: [
      `${session.title} with ${options.coachName}, ${spotsText(options.spots)}`,
      `Booked through BookOn${options.url ? `: ${options.url}` : ""}`,
    ].join("\n"),
    location: session.place,
    url: options.url,
    status: "CONFIRMED",
  };
}

function details(session: Session, booking: Booking, coachName: string): [string, string][] {
  return [
    ["Session", `${session.title}, ${sessionMinutes(session)} min`],
    ["Coach", coachName],
    ["When", lessonWhen(session.startTime)],
    ["Where", session.place],
    ["Spots", String(booking.spots)],
  ];
}

const CANCEL_RULE =
  "You can cancel for a full refund up to 24 hours before the session. After that, it can't be refunded.";

/** The minimum isn't reached yet: say what happens if it isn't. */
function minimumNote(session: Session): string | null {
  if (!session.minSpots || session.goingAheadAt) return null;
  return `This session needs at least ${session.minSpots} people. If it doesn't get them by 24 hours before, it's called off and you're refunded in full automatically.`;
}

/** To the golfer, once they've paid. */
export function groupBookedEmail(input: {
  session: Session;
  booking: Booking;
  coachName: string;
  coachContact: { phone?: string; email?: string };
  manageLink: string;
}): EmailMessage {
  const { session, booking } = input;
  const event = groupCalendarEvent(session, {
    for: "golfer",
    coachName: input.coachName,
    spots: booking.spots,
    url: input.manageLink,
  });
  return message({
    to: booking.golferEmail,
    subject: `Booked: ${session.title} with ${input.coachName}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${booking.golferName},`,
    paragraphs: [
      `You're in! Your card has been charged for ${spotsText(booking.spots)}.`,
      minimumNote(session),
    ],
    details: [
      ...details(session, booking, input.coachName),
      [
        `${spotsText(booking.spots)} at ${formatPrice(session.priceCents)}`,
        formatPrice(booking.spotsCents),
      ],
      ["Booking fee", formatPrice(booking.feeCents)],
      ["Total", formatPrice(booking.spotsCents + booking.feeCents)],
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

/** To the coach: someone booked spots. */
export function groupBookedCoachEmail(input: {
  to: string;
  session: Session;
  booking: Booking;
  coachName: string;
  booked: number;
  spots: number;
  portalLink: string;
}): EmailMessage {
  const { session, booking } = input;
  return message({
    to: input.to,
    subject: `${booking.golferName} booked ${spotsText(booking.spots)}: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${booking.golferName} booked and paid for ${spotsText(booking.spots)}. ${input.booked} of ${input.spots} spots are now taken.`,
    ],
    details: [
      ["Session", session.title],
      ["When", lessonWhen(session.startTime)],
      ["Golfer", booking.golferName],
      ["Mobile", formatAuPhone(booking.golferPhone)],
      ["Email", booking.golferEmail],
      ["Their note", booking.note],
      ["You'll be paid", formatPrice(booking.spotsCents)],
    ],
    link: { href: input.portalLink, label: "See who's coming" },
  });
}

/** To the golfer, after they cancel. */
export function groupCancelledEmail(input: {
  session: Session;
  booking: Booking;
  coachName: string;
  refundCents: number;
}): EmailMessage {
  const { session, booking } = input;
  return message({
    to: booking.golferEmail,
    subject: `Cancelled: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${booking.golferName},`,
    paragraphs: [
      `Your ${spotsText(booking.spots)} at ${session.title} with ${input.coachName} on ${lessonWhen(session.startTime)} ${booking.spots === 1 ? "is" : "are"} cancelled.`,
      input.refundCents > 0
        ? `We've refunded ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`
        : "As it was cancelled less than 24 hours before, it isn't refunded.",
    ],
  });
}

/** To the coach, when a golfer cancels. */
export function groupCancelledCoachEmail(input: {
  to: string;
  session: Session;
  booking: Booking;
  coachName: string;
  refunded: boolean;
}): EmailMessage {
  const { session, booking } = input;
  return message({
    to: input.to,
    subject: `${booking.golferName} cancelled: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${booking.golferName} cancelled their ${spotsText(booking.spots)} at ${session.title} on ${lessonWhen(session.startTime)}. The ${booking.spots === 1 ? "spot is" : "spots are"} free again on BookOn.`,
      input.refunded
        ? "They cancelled 24 hours or more before, so they were refunded and the payment to you is reversed."
        : `They cancelled less than 24 hours before, so you keep the ${formatPrice(booking.spotsCents)}.`,
    ],
  });
}

/** To each golfer, when the coach cancels the session or it doesn't reach its minimum. */
export function groupSessionCancelledEmail(input: {
  session: Session;
  booking: Booking;
  coachName: string;
  reason: "coach" | "minimum";
  note: string | null;
  refundCents: number;
  coachPage: string;
}): EmailMessage {
  const { session, booking } = input;
  return message({
    to: booking.golferEmail,
    subject: `Called off: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${booking.golferName},`,
    paragraphs: [
      input.reason === "minimum"
        ? `Sorry, ${session.title} with ${input.coachName} on ${lessonWhen(session.startTime)} didn't get the ${session.minSpots} people it needed, so it's called off.`
        : `Sorry, ${input.coachName} had to cancel ${session.title} on ${lessonWhen(session.startTime)}.`,
      input.note && `${input.coachName} says: "${input.note}"`,
      `We've refunded the full ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`,
    ],
    link: { href: input.coachPage, label: `See ${input.coachName}'s other sessions` },
  });
}

/** To the coach, when a session didn't reach its minimum. */
export function groupCalledOffCoachEmail(input: {
  to: string;
  session: Session;
  coachName: string;
  booked: number;
}): EmailMessage {
  const { session } = input;
  return message({
    to: input.to,
    subject: `Called off: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${session.title} on ${lessonWhen(session.startTime)} had ${input.booked} of the ${session.minSpots} people it needed 24 hours before, so we've called it off as you set up.`,
      input.booked > 0
        ? "Everyone who booked has been refunded in full and told by email."
        : "Nobody had booked, so there's nothing else to do.",
    ],
  });
}

/** To the coach, when the minimum is reached 24 hours before. */
export function groupGoingAheadCoachEmail(input: {
  to: string;
  session: Session;
  coachName: string;
  booked: number;
  portalLink: string;
}): EmailMessage {
  const { session } = input;
  return message({
    to: input.to,
    subject: `Going ahead: ${session.title}, ${lessonWhen(session.startTime)}`,
    greeting: `Hi ${input.coachName.split(" ")[0]},`,
    paragraphs: [
      `${session.title} on ${lessonWhen(session.startTime)} has ${input.booked} booked, so it's going ahead.`,
    ],
    link: { href: input.portalLink, label: "See who's coming" },
  });
}
