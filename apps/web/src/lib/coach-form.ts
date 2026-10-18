/** Reading a coach's listing from the portal form (Milestone 12). */
import {
  isAreaId,
  isSpecialityId,
  normaliseAuPhone,
  type CoachAway,
  type CoachHours,
  type CoachPlace,
  type CoachProfile,
  type CoachRate,
  type SpecialityId,
} from "@bookon/core";
import { normaliseEmail } from "@bookon/db";
import { str, webAddress } from "./club-form";

export const MAX_PLACES = 3;
export const MAX_RATES = 6;
export const MAX_AWAY = 3;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The listing as typed, or the problems to fix. `courses` are the BookOn
 * courses and venues a coach can say they teach at.
 */
export function parseCoachForm(
  form: FormData,
  courses: { slug: string; name: string; suburb: string }[],
): { profile: CoachProfile; problems: string[] } {
  const problems: string[] = [];
  const name = str(form, "name", 80) ?? "";
  if (!name) problems.push("Add your name.");
  const headline = str(form, "headline", 100) ?? "";
  if (!headline) problems.push("Add a one-line summary of what you teach.");
  const bio = str(form, "bio", 1500) ?? "";
  if (!bio) problems.push("Tell golfers a little about your coaching.");

  const specialities = form
    .getAll("speciality")
    .map(String)
    .filter((s): s is SpecialityId => isSpecialityId(s));
  if (specialities.length === 0) problems.push("Pick at least one speciality.");

  const suburb = str(form, "suburb", 60) ?? "";
  const area = String(form.get("area") ?? "");
  if (!suburb) problems.push("Add the suburb you're based in.");
  if (!isAreaId(area)) problems.push("Pick your area.");

  const places: CoachPlace[] = [];
  for (let i = 0; i < MAX_PLACES; i++) {
    const course = courses.find((c) => c.slug === String(form.get(`place${i}Course`) ?? ""));
    if (course) {
      places.push({ courseSlug: course.slug, name: course.name, suburb: course.suburb });
      continue;
    }
    const placeName = str(form, `place${i}Name`, 80);
    const placeSuburb = str(form, `place${i}Suburb`, 60);
    if (placeName || placeSuburb) places.push({ name: placeName ?? "", suburb: placeSuburb ?? "" });
  }
  if (places.length === 0) problems.push("Add at least one place you teach.");
  if (places.some((p) => !p.name || !p.suburb))
    problems.push("Give each place you teach a name and suburb.");

  const rates: CoachRate[] = [];
  for (let i = 0; i < MAX_RATES; i++) {
    const rateName = str(form, `rate${i}Name`, 60);
    const minutes = Number(form.get(`rate${i}Minutes`));
    const price = Number(String(form.get(`rate${i}Price`) ?? "").replace(/[$,\s]/g, ""));
    const people = String(form.get(`rate${i}People`) ?? "1");
    if (!rateName && !form.get(`rate${i}Price`)) continue;
    if (
      !rateName ||
      !(Number.isInteger(minutes) && minutes >= 10 && minutes <= 600) ||
      !(price > 0 && price < 10000)
    ) {
      problems.push(`Lesson ${i + 1} needs a name, a length in minutes and a price.`);
      continue;
    }
    rates.push({
      name: rateName,
      minutes,
      priceCents: Math.round(price * 100),
      people: people === "2" || people === "group" ? people : "1",
    });
  }
  if (rates.length === 0) problems.push("Add at least one lesson and its price.");

  const hours: CoachHours[] = [];
  for (let day = 1; day <= 7; day++) {
    const from = String(form.get(`hours${day}From`) ?? "");
    const to = String(form.get(`hours${day}To`) ?? "");
    if (!from && !to) continue;
    if (!TIME.test(from) || !TIME.test(to) || to <= from) {
      problems.push("Each teaching day needs a start time before its finish time.");
      continue;
    }
    hours.push({ day, from, to });
  }
  if (hours.length === 0) problems.push("Add the hours you usually teach.");

  const away: CoachAway[] = [];
  for (let i = 0; i < MAX_AWAY; i++) {
    const from = String(form.get(`away${i}From`) ?? "");
    const to = String(form.get(`away${i}To`) ?? "") || from;
    if (!from) continue;
    if (!DATE.test(from) || !DATE.test(to) || to < from) {
      problems.push("Each time away needs a first and last day, in order.");
      continue;
    }
    away.push({ from, to });
  }

  const whatsappText = str(form, "whatsapp", 30);
  const phoneText = str(form, "phone", 30);
  const whatsapp = whatsappText ? normaliseAuPhone(whatsappText) : null;
  const phone = phoneText ? normaliseAuPhone(phoneText) : null;
  if (whatsappText && !whatsapp)
    problems.push("Check your WhatsApp number (an Australian mobile).");
  if (phoneText && !phone) problems.push("Check your phone number.");
  const emailText = str(form, "email", 254);
  const email = emailText ? normaliseEmail(emailText) : null;
  if (emailText && !email) problems.push("Check your email address.");
  const websiteText = str(form, "website", 200);
  const website = webAddress(websiteText);
  if (websiteText && !website) problems.push("Check your website address.");
  if (!whatsapp && !phone && !email)
    problems.push("Add at least one way to reach you: WhatsApp, phone or email.");

  const pgaNumber = str(form, "pgaNumber", 30);
  return {
    profile: {
      name,
      headline,
      bio,
      ...(pgaNumber ? { pgaNumber } : {}),
      specialities,
      rates,
      hours,
      away,
      places,
      suburb,
      area: isAreaId(area) ? area : "",
      contact: {
        ...(whatsapp ? { whatsapp } : {}),
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(website ? { website } : {}),
      },
    },
    problems,
  };
}
