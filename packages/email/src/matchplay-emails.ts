import {
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
} from "@bookon/core";
import type { MatchplayComp, MatchplayEntry } from "@bookon/db";
import { detailMessage as message } from "./lesson-emails";
import type { EmailMessage } from "./mailer";

/** Emails about match play competitions (Milestone 22). */

type Comp = Pick<MatchplayComp, "title" | "teamSize">;
type Entry = Pick<
  MatchplayEntry,
  "players" | "contactName" | "contactEmail" | "contactPhone" | "feesCents" | "bookingFeeCents"
>;

interface Where {
  clubName: string;
  /** The course page on BookOn, to find a tee time. */
  courseLink: string;
}

/** "Alex Golfer" or "Alex Golfer & Sam Golfer". */
export function entryLabel(entry: Pick<MatchplayEntry, "players">): string {
  return entry.players.map((p) => p.name).join(" & ");
}

function when(date: Date): string {
  return `${formatPerthDay(perthDate(date))}, ${formatPerthTime(date)}`;
}

function contact(entry: Entry): [string, string | null][] {
  return [
    ["Their mobile", entry.contactPhone ? formatAuPhone(entry.contactPhone) : null],
    ["Their email", entry.contactEmail],
  ];
}

/** To the golfer when they're in. */
export function mpEnteredEmail(input: {
  comp: Comp;
  entry: Entry & { contactEmail: string };
  where: Where;
  manageLink: string;
}): EmailMessage {
  const { comp, entry } = input;
  const paid = entry.feesCents + entry.bookingFeeCents;
  return message({
    to: entry.contactEmail,
    subject: `Entered: ${comp.title}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `You're in ${comp.title} at ${input.where.clubName}.${paid > 0 ? ` Your card was charged ${formatPrice(paid)}.` : ""}`,
      "When the club makes the draw, we'll email you your first opponent, how to reach them, and the date to play by.",
    ],
    details: [["Entry", entryLabel(entry)]],
    link: { href: input.manageLink, label: "See your entry" },
  });
}

/** To the club for each online entry. */
export function mpEntryClubEmail(input: {
  to: string;
  comp: Comp;
  entry: Entry;
  entered: number;
  portalLink: string;
}): EmailMessage {
  const { comp, entry } = input;
  return message({
    to: input.to,
    subject: `New entry: ${comp.title}, ${entryLabel(entry)}`,
    greeting: "Hi,",
    paragraphs: [`${entryLabel(entry)} entered ${comp.title}. That's ${input.entered} so far.`],
    details: [
      ["Mobile", entry.contactPhone ? formatAuPhone(entry.contactPhone) : null],
      ["Email", entry.contactEmail],
      ["Entry fees to the club", entry.feesCents > 0 ? formatPrice(entry.feesCents) : null],
    ],
    link: { href: input.portalLink, label: "See all entries" },
  });
}

/** To the golfer after they or the club withdraw them, or the club cancels. */
export function mpEntryEndedEmail(input: {
  comp: Comp;
  entry: Entry & { contactEmail: string };
  where: Where;
  reason: "golfer" | "club" | "comp";
  refundCents: number;
  note?: string | null;
}): EmailMessage {
  const { comp, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `${input.reason === "comp" ? "Cancelled" : "Withdrawn"}: ${comp.title}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      input.reason === "comp"
        ? `Sorry, ${input.where.clubName} has cancelled ${comp.title}.`
        : input.reason === "club"
          ? `${input.where.clubName} has withdrawn your entry in ${comp.title}.`
          : `Your entry in ${comp.title} is withdrawn.`,
      input.note && `${input.where.clubName} says: "${input.note}"`,
      input.refundCents > 0 &&
        `We've refunded ${formatPrice(input.refundCents)} to your card. It usually shows in 5 to 10 business days.`,
    ],
  });
}

/** To each side when their match is set: who, how to reach them, and when by. */
export function mpMatchEmail(input: {
  comp: Comp;
  entry: Entry & { contactEmail: string };
  opponent: Entry;
  round: string;
  playBy: string | null;
  where: Where;
  manageLink: string;
}): EmailMessage {
  const { comp, entry, opponent } = input;
  return message({
    to: entry.contactEmail,
    subject: `${comp.title}, ${input.round}: you play ${entryLabel(opponent)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `Your ${input.round.toLowerCase()} match in ${comp.title} is against ${entryLabel(opponent)}.${input.playBy ? ` Please play it by ${formatPerthDay(input.playBy)}.` : ""}`,
      `Get in touch with ${opponent.contactName} to arrange a time. When you've played, either of you can report the result from your link.`,
    ],
    details: [
      ["Opponent", entryLabel(opponent)],
      ...contact(opponent),
      ["Play by", input.playBy ? formatPerthDay(input.playBy) : null],
    ],
    link: { href: input.manageLink, label: "Report the result" },
    links: [{ href: input.where.courseLink, label: `Find a tee time at ${input.where.clubName}` }],
  });
}

/** To an entry with a first-round bye. */
export function mpByeEmail(input: {
  comp: Comp;
  entry: Entry & { contactEmail: string };
  manageLink: string;
}): EmailMessage {
  const { comp, entry } = input;
  return message({
    to: entry.contactEmail,
    subject: `${comp.title}: you have a bye into round 2`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `The draw for ${comp.title} is out, and you have a bye through the first round.`,
      "We'll email you your next opponent as soon as they're known.",
    ],
    link: { href: input.manageLink, label: "See the draw" },
  });
}

/** To the other side when one side reports the result. */
export function mpResultReportedEmail(input: {
  comp: Comp;
  to: Entry & { contactEmail: string };
  reporter: Entry;
  winner: Entry;
  score: string | null;
  disputeBy: Date;
  manageLink: string;
}): EmailMessage {
  const { comp, to } = input;
  return message({
    to: to.contactEmail,
    subject: `Result reported: ${comp.title}`,
    greeting: `Hi ${to.contactName},`,
    paragraphs: [
      `${entryLabel(input.reporter)} reported your match in ${comp.title}: ${entryLabel(input.winner)} won${input.score ? ` ${input.score}` : ""}.`,
      `If that's right, confirm it and it stands now. If not, dispute it by ${when(input.disputeBy)} and the club will decide. Otherwise it stands then.`,
    ],
    link: { href: input.manageLink, label: "Confirm or dispute" },
  });
}

/** To the club when a result is disputed. */
export function mpDisputeClubEmail(input: {
  to: string;
  comp: Comp;
  sides: [Entry, Entry];
  reportedWinner: Entry;
  score: string | null;
  note: string | null;
  portalLink: string;
}): EmailMessage {
  const { comp } = input;
  return message({
    to: input.to,
    subject: `Result disputed: ${comp.title}`,
    greeting: "Hi,",
    paragraphs: [
      `${entryLabel(input.sides[0])} v ${entryLabel(input.sides[1])}: the result was reported as ${entryLabel(input.reportedWinner)} winning${input.score ? ` ${input.score}` : ""}, and it's been disputed.`,
      input.note && `They said: "${input.note}"`,
      "Please speak to both sides and record the result in the club portal.",
    ],
    link: { href: input.portalLink, label: "Record the result" },
  });
}

/** To each side when a result stands. */
export function mpResultEmail(input: {
  comp: Comp;
  to: Entry & { contactEmail: string };
  winner: Entry;
  score: string | null;
  byClub: boolean;
  manageLink: string;
}): EmailMessage {
  const { comp, to } = input;
  return message({
    to: to.contactEmail,
    subject: `Result: ${comp.title}`,
    greeting: `Hi ${to.contactName},`,
    paragraphs: [
      `${input.byClub ? "The club has recorded" : "The result stands for"} your match in ${comp.title}: ${entryLabel(input.winner)} won${input.score ? ` ${input.score}` : ""}.`,
    ],
    link: { href: input.manageLink, label: "See the draw" },
  });
}

/** To both sides when the play-by date is close and there's no result. */
export function mpReminderEmail(input: {
  comp: Comp;
  entry: Entry & { contactEmail: string };
  opponent: Entry;
  playBy: string;
  where: Where;
  manageLink: string;
}): EmailMessage {
  const { comp, entry, opponent } = input;
  return message({
    to: entry.contactEmail,
    subject: `Reminder: play ${entryLabel(opponent)} by ${formatPerthDay(input.playBy)}`,
    greeting: `Hi ${entry.contactName},`,
    paragraphs: [
      `Your match against ${entryLabel(opponent)} in ${comp.title} needs to be played by ${formatPerthDay(input.playBy)}.`,
      "If you've played, report the result. If you can't play, let the club know.",
    ],
    details: contact(opponent),
    link: { href: input.manageLink, label: "Report the result" },
    links: [{ href: input.where.courseLink, label: `Find a tee time at ${input.where.clubName}` }],
  });
}

/** To the club when a match is past its play-by date without a result. */
export function mpOverdueClubEmail(input: {
  to: string;
  comp: Comp;
  sides: [Entry, Entry];
  playBy: string;
  disputed: boolean;
  portalLink: string;
}): EmailMessage {
  const { comp } = input;
  return message({
    to: input.to,
    subject: `Overdue: ${entryLabel(input.sides[0])} v ${entryLabel(input.sides[1])}`,
    greeting: "Hi,",
    paragraphs: [
      `In ${comp.title}, ${entryLabel(input.sides[0])} v ${entryLabel(input.sides[1])} was due by ${formatPerthDay(input.playBy)} and ${input.disputed ? "its result is disputed" : "has no result"}.`,
      "You can record the result or award a walkover in the club portal.",
    ],
    link: { href: input.portalLink, label: "Open the competition" },
  });
}

/** To the club and the winners when the final is decided. */
export function mpChampionEmail(input: {
  to: string;
  comp: Comp;
  winner: Entry;
  greeting?: string;
  link: string;
}): EmailMessage {
  const { comp } = input;
  return message({
    to: input.to,
    subject: `${comp.title}: ${entryLabel(input.winner)} won`,
    greeting: input.greeting ?? "Hi,",
    paragraphs: [`${entryLabel(input.winner)} won ${comp.title}. Congratulations!`],
    link: { href: input.link, label: "See the draw" },
  });
}
