import {
  BOOKON_UID_SUFFIX,
  TEAM_NAME,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  googleCalendarEventLink,
  groupStart,
  groupStartLabel,
  perthDate,
  type CalendarEvent,
  type TeamSize,
} from "@bookon/core";
import type { ClubEvent, EventEntry } from "@bookon/db";
import { detailMessage as message } from "./lesson-emails";
import type { EmailMessage } from "./mailer";

/** Emails about club events (Milestone 21). */

type Event = Pick<
  ClubEvent,
  | "id"
  | "title"
  | "date"
  | "holes"
  | "startType"
  | "firstStart"
  | "intervalMinutes"
  | "twoTees"
  | "teamSize"
  | "entriesClose"
  | "results"
>;
type Entry = Pick<
  EventEntry,
  | "id"
  | "players"
  | "playerCount"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "note"
  | "feesCents"
  | "bookingFeeCents"
  | "startGroup"
>;

interface Where {
  clubName: string;
  courseName: string;
}

/** "Point Walter Golf Club, Point Walter" or just the one name when they're the same. */
export function eventPlace(where: Where): string {
  return where.clubName === where.courseName
    ? where.clubName
    : `${where.clubName}, ${where.courseName}`;
}

/** "Sat 14 Nov". */
function day(event: Pick<ClubEvent, "date">): string {
  return formatPerthDay(event.date);
}

/** "Thu 12 Nov, 5:00 pm". */
function when(date: Date): string {
  return `${formatPerthDay(perthDate(date))}, ${formatPerthTime(date)}`;
}

function players(entry: Pick<EventEntry, "players">): string {
  return entry.players
    .map((p) => (p.memberNumber ? `${p.name} (member ${p.memberNumber})` : p.name))
    .join(", ");
}

function eventDetails(event: Event, where: Where): [string, string][] {
  return [
    ["Event", event.title],
    ["Where", eventPlace(where)],
    ["Day", day(event)],
    [
      "Start",
      event.startType === "shotgun"
        ? `${formatPerthTime(event.firstStart)} shotgun`
        : `Tee times from ${formatPerthTime(event.firstStart)}`,
    ],
    ["Format", `${TEAM_NAME[event.teamSize as TeamSize]}, ${event.holes} holes`],
  ];
}

/** The golfer's group, as a calendar event, once the start sheet is out. */
export function eventCalendarEvent(
  event: Event,
  entry: Pick<EventEntry, "id" | "startGroup">,
  where: Where,
  url?: string,
): CalendarEvent {
  const start = entry.startGroup
    ? groupStart(event, entry.startGroup).time
    : new Date(event.firstStart);
  // About 4.5 hours for 18 holes, 2.5 for 9.
  const end = new Date(start.getTime() + (event.holes === 9 ? 2.5 : 4.5) * 3_600_000);
  return {
    uid: `event-entry-${entry.id}${BOOKON_UID_SUFFIX}`,
    start,
    end,
    summary: `${event.title}, ${where.clubName}`,
    description: [
      entry.startGroup ? `Your start: ${groupStartLabel(event, entry.startGroup)}` : null,
      `Entered through BookOn${url ? `: ${url}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: where.courseName,
    url,
    status: "CONFIRMED",
  };
}

/** To the golfer, once they've paid. */
export function eventEnteredEmail(input: {
  event: Event;
  entry: Entry;
  where: Where;
  manageLink: string;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `Entered: ${event.title}, ${day(event)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `You're in! Your card has been charged ${formatPrice(entry.feesCents + entry.bookingFeeCents)}.`,
      `${input.where.clubName} will send start times once they've made the start sheet. We'll email you yours.`,
    ],
    details: [
      ...eventDetails(event, input.where),
      ["Players", players(entry)],
      ["Entry fees", formatPrice(entry.feesCents)],
      ["Booking fee", formatPrice(entry.bookingFeeCents)],
      ["Total", formatPrice(entry.feesCents + entry.bookingFeeCents)],
    ],
    link: { href: input.manageLink, label: "See or withdraw your entry" },
    after: [
      `You can withdraw for a full refund until entries close, ${when(event.entriesClose)}. After that, refunds are up to the club.`,
      "Your receipt comes from Stripe, who handles payments for BookOn.",
    ],
  });
}

/** To the club, for each new entry. */
export function eventEntryClubEmail(input: {
  to: string;
  event: Event;
  entry: Entry;
  where: Where;
  entered: number;
  maxPlayers: number;
  portalLink: string;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: input.to,
    subject: `New entry: ${event.title}, ${entry.contactName}`,
    greeting: "Hi,",
    paragraphs: [
      `${entry.contactName} entered ${event.title} and paid. ${input.entered} of ${input.maxPlayers} places are now taken.`,
      entry.players.some((p) => p.memberNumber) &&
        "Some players gave member numbers for the members' fee. Please check them.",
    ],
    details: [
      ["Players", players(entry)],
      ["Mobile", formatAuPhone(entry.contactPhone)],
      ["Email", entry.contactEmail],
      ["Their note", entry.note],
      ["Entry fees to the club", formatPrice(entry.feesCents)],
    ],
    link: { href: input.portalLink, label: "See all entries" },
  });
}

/** To the golfer, after they or the club withdraw their entry. */
export function eventWithdrawnEmail(input: {
  event: Event;
  entry: Entry;
  where: Where;
  by: "golfer" | "club";
  refundCents: number;
  note?: string | null;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `Withdrawn: ${event.title}, ${day(event)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      input.by === "golfer"
        ? `Your entry in ${event.title} on ${day(event)} is withdrawn.`
        : `${input.where.clubName} has withdrawn your entry in ${event.title} on ${day(event)}.`,
      input.note && `${input.where.clubName} says: "${input.note}"`,
      input.refundCents > 0
        ? `We've refunded ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`
        : "It isn't refunded. Contact the club if you think it should be.",
    ],
  });
}

/** To the club, when a golfer withdraws. */
export function eventWithdrawnClubEmail(input: {
  to: string;
  event: Event;
  entry: Entry;
  refunded: boolean;
  portalLink: string;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: input.to,
    subject: `Withdrawn: ${event.title}, ${entry.contactName}`,
    greeting: "Hi,",
    paragraphs: [
      `${entry.contactName} withdrew from ${event.title} (${players(entry)}). Their places are free again.`,
      input.refunded
        ? "It was before entries closed, so they were refunded and the payment to the club is reversed."
        : `It was after entries closed, so the club keeps the ${formatPrice(entry.feesCents)}. You can refund them from the club portal if you'd like.`,
      entry.startGroup !== null && "They were on the start sheet, so check it in the club portal.",
    ],
    link: { href: input.portalLink, label: "See the entries" },
  });
}

/** To each entrant, when the club cancels the event. */
export function eventCancelledEmail(input: {
  event: Event;
  entry: Entry;
  where: Where;
  note: string | null;
  refundCents: number;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `Cancelled: ${event.title}, ${day(event)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `Sorry, ${input.where.clubName} has cancelled ${event.title} on ${day(event)}.`,
      input.note && `${input.where.clubName} says: "${input.note}"`,
      `We've refunded the full ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`,
    ],
  });
}

/** To each entrant when the start sheet is published, or their start changes. */
export function eventStartEmail(input: {
  event: Event;
  entry: Entry;
  where: Where;
  /** The other players in their group. */
  playingWith: string[];
  changed: boolean;
  manageLink: string;
}): EmailMessage {
  const { event, entry } = input;
  const start = groupStartLabel(event, entry.startGroup!);
  const cal = eventCalendarEvent(event, entry, input.where, input.manageLink);
  return message({
    to: entry.contactEmail,
    subject: `${input.changed ? "New start time" : "Your start time"}: ${event.title}, ${start}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      input.changed
        ? `${input.where.clubName} has moved your group for ${event.title} on ${day(event)}.`
        : `${input.where.clubName} has made the start sheet for ${event.title} on ${day(event)}.`,
    ],
    details: [
      ["Your start", start],
      ["Group", String(entry.startGroup)],
      ["Playing with", input.playingWith.join(", ") || "Just your team"],
      ["Where", eventPlace(input.where)],
    ],
    link: { href: input.manageLink, label: "See the start sheet" },
    links: [
      { href: `${input.manageLink}/calendar.ics`, label: "Add to Apple or Outlook calendar" },
      { href: googleCalendarEventLink(cal), label: "Add to Google Calendar" },
    ],
  });
}

/** To golfers on the waiting list when places free up. */
export function eventPlaceFreeEmail(input: {
  to: string;
  name: string;
  event: Event;
  where: Where;
  left: number;
  eventLink: string;
}): EmailMessage {
  const { event } = input;
  return message({
    to: input.to,
    subject: `A place is free: ${event.title}, ${day(event)}`,
    greeting: `Hi ${input.name},`,
    paragraphs: [
      `${input.left} ${input.left === 1 ? "place has" : "places have"} come up in ${event.title} at ${input.where.clubName} on ${day(event)}.`,
      "Everyone on the waiting list gets this email, and the first to enter and pay gets the place.",
    ],
    link: { href: input.eventLink, label: "Enter now" },
  });
}

/** To the club when entries close. */
export function eventClosedClubEmail(input: {
  to: string;
  event: Event;
  entries: number;
  players: number;
  maxPlayers: number;
  portalLink: string;
}): EmailMessage {
  const { event } = input;
  return message({
    to: input.to,
    subject: `Entries closed: ${event.title}, ${day(event)}`,
    greeting: "Hi,",
    paragraphs: [
      `Entries for ${event.title} have closed with ${input.entries} ${input.entries === 1 ? "entry" : "entries"} (${input.players} of ${input.maxPlayers} players).`,
      "Next, make the start sheet and publish it. Everyone gets an email with their time.",
    ],
    link: { href: input.portalLink, label: "Make the start sheet" },
  });
}

/** To each entrant the day before. */
export function eventReminderEmail(input: {
  event: Event;
  entry: Entry;
  where: Where;
  manageLink: string;
}): EmailMessage {
  const { event, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `Reminder: ${event.title}, ${day(event)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `See you at ${input.where.clubName} for ${event.title}.`,
      entry.startGroup
        ? `Your start: ${groupStartLabel(event, entry.startGroup)}. Please arrive in good time.`
        : "The club hasn't sent start times yet. Check the event page or ask the club.",
    ],
    details: [["Players", players(entry)]],
    link: { href: input.manageLink, label: "See your entry" },
  });
}
