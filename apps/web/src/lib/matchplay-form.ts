/** Reading a match play competition, and club-added entries, from the club portal (Milestone 22). */
import { MATCHPLAY_MAX_ENTRIES, normaliseAuPhone, perthToUtc } from "@bookon/core";
import { normaliseEmail, type CompInput } from "@bookon/db";
import { str } from "./club-form";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCompForm(
  form: FormData,
  courseIds: string[],
  now: Date,
): { input: CompInput | null; problems: string[] } {
  const problems: string[] = [];
  const title = str(form, "title", 100) ?? "";
  if (!title) problems.push('Give the competition a name, like "Club Matchplay Championship".');
  const description = str(form, "description", 2000) ?? null;
  const courseId = String(form.get("courseId") ?? "");
  if (!courseIds.includes(courseId)) problems.push("Pick which course it's on.");
  const teamSize = form.get("teamSize") === "2" ? 2 : 1;
  const onlineEntry = form.get("onlineEntry") === "yes";

  const feeText = String(form.get("fee") ?? "").replace(/[$,\s]/g, "");
  const fee = feeText ? Number(feeText) : 0;
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000)
    problems.push("Enter an entry fee per player between $0 and $1000.");
  const feeCents = onlineEntry ? Math.round(fee * 100) : 0;
  if (feeCents > 0 && feeCents < 100)
    problems.push("A fee needs to be at least $1, or $0 for free.");

  const maxEntries = Number(form.get("maxEntries"));
  if (!Number.isInteger(maxEntries) || maxEntries < 2 || maxEntries > MATCHPLAY_MAX_ENTRIES)
    problems.push(`Enter a field of 2 to ${MATCHPLAY_MAX_ENTRIES} entries.`);

  const closeDate = String(form.get("closeDate") ?? "");
  const closeTime = String(form.get("closeTime") ?? "") || "17:00";
  let entriesClose: Date | null = null;
  if (closeDate) {
    if (!DATE.test(closeDate) || !TIME.test(closeTime)) problems.push("Check when entries close.");
    else {
      entriesClose = perthToUtc(closeDate, closeTime);
      if (entriesClose <= now) problems.push("Entries need to close in the future.");
    }
  } else if (onlineEntry) problems.push("Pick when online entries close.");

  const open = form.get("open") !== "members";
  if (problems.length > 0) return { input: null, problems };
  return {
    input: {
      courseId,
      title,
      description,
      teamSize,
      onlineEntry,
      feeCents,
      maxEntries,
      entriesClose,
      open,
    },
    problems: [],
  };
}

/** A club-added entry: names, and an email or mobile so opponents can reach them. */
export function parseClubEntry(
  form: FormData,
  teamSize: number,
):
  | {
      entry: {
        players: { name: string }[];
        contactEmail: string | null;
        contactPhone: string | null;
      };
    }
  | { problem: string } {
  const players = Array.from({ length: teamSize }, (_, i) => ({
    name: str(form, `player${i}`, 80) ?? "",
  }));
  if (players.some((p) => !p.name))
    return { problem: teamSize === 2 ? "Add both players' names." : "Add the player's name." };
  const emailText = str(form, "email", 254);
  const phoneText = str(form, "phone", 20);
  const contactEmail = emailText ? normaliseEmail(emailText) : null;
  const contactPhone = phoneText ? normaliseAuPhone(phoneText) : null;
  if (emailText && !contactEmail) return { problem: "Check the email address." };
  if (phoneText && !contactPhone) return { problem: "Check the mobile number, like 0412 345 678." };
  if (!contactEmail && !contactPhone)
    return { problem: "Add an email or a mobile, so their opponents can reach them." };
  return { entry: { players, contactEmail, contactPhone } };
}
