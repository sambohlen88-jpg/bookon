/** Reading a coach's listing from the portal form (Milestone 12). */
import {
  isAreaId,
  isLessonKind,
  isSpecialityId,
  MAX_COACH_LESSONS,
  MAX_COACH_PLACES,
  normaliseAuPhone,
  placeKey,
  PLAYER_CHOICE,
  type CoachAway,
  type CoachHours,
  type CoachPlace,
  type CoachProfile,
  type CoachRate,
  type CoachTravel,
  type SpecialityId,
} from "@bookon/core";
import { normaliseEmail } from "@bookon/db";
import { str, webAddress } from "./club-form";

export const MAX_PLACES = MAX_COACH_PLACES;
export const MAX_RATES = MAX_COACH_LESSONS;
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

  // Happy to travel (Milestone 26): to these areas, and then places are optional.
  let travel: CoachTravel | undefined;
  if (form.get("travel")) {
    const areas = [...new Set(form.getAll("travelArea").map(String).filter(isAreaId))];
    if (areas.length === 0) problems.push("Pick the areas you'll travel to.");
    const note = str(form, "travelNote", 120);
    travel = { areas, ...(note ? { note } : {}) };
  }

  // Each row's place, by its number on the form, for lessons to point at.
  const placeAt = new Map<number, CoachPlace>();
  const places: CoachPlace[] = [];
  for (let i = 0; i < MAX_PLACES; i++) {
    const course = courses.find((c) => c.slug === String(form.get(`place${i}Course`) ?? ""));
    const placeName = str(form, `place${i}Name`, 80);
    const placeSuburb = str(form, `place${i}Suburb`, 60);
    const place: CoachPlace | null = course
      ? { courseSlug: course.slug, name: course.name, suburb: course.suburb }
      : placeName || placeSuburb
        ? { name: placeName ?? "", suburb: placeSuburb ?? "" }
        : null;
    if (!place || places.some((p) => placeKey(p) === placeKey(place))) continue;
    places.push(place);
    placeAt.set(i, place);
  }
  if (places.length === 0 && !travel)
    problems.push("Add at least one place you teach, or say you're happy to travel.");
  if (places.some((p) => !p.name || !p.suburb))
    problems.push("Give each place you teach a name and suburb.");

  const SPECIAL_NAMES: Record<string, string> = {
    Weekend: "weekend",
    PublicHoliday: "public holiday",
    SchoolHoliday: "school holiday",
  };
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
    // Special rates (Milestone 19): optional, the normal price applies when empty.
    const special = (field: string): number | undefined => {
      const text = String(form.get(`rate${i}${field}`) ?? "").replace(/[$,\s]/g, "");
      if (!text) return undefined;
      const value = Number(text);
      if (!(value > 0 && value < 10000)) {
        problems.push(`Lesson ${i + 1}: check the ${SPECIAL_NAMES[field]} price.`);
        return undefined;
      }
      return Math.round(value * 100);
    };
    const kind = String(form.get(`rate${i}Kind`) ?? "");
    if (!isLessonKind(kind)) problems.push(`Lesson ${i + 1}: pick the type of lesson.`);
    // Where it's taught (Milestone 26): every place unless the coach picks some.
    let at: string[] | undefined;
    if (form.get(`rate${i}Where`) === "some") {
      at = form
        .getAll(`rate${i}At`)
        .map(String)
        .flatMap((value) => {
          if (value === PLAYER_CHOICE) return travel ? [PLAYER_CHOICE] : [];
          const place = placeAt.get(Number(value));
          return place ? [placeKey(place)] : [];
        });
      if (at.length === 0) problems.push(`Lesson ${i + 1}: pick where it's taught.`);
    }
    const weekendCents = special("Weekend");
    const publicHolidayCents = special("PublicHoliday");
    const schoolHolidayCents = special("SchoolHoliday");
    rates.push({
      name: rateName,
      ...(isLessonKind(kind) ? { kind } : {}),
      ...(at && at.length > 0 ? { at } : {}),
      minutes,
      priceCents: Math.round(price * 100),
      people: people === "2" || people === "group" ? people : "1",
      ...(weekendCents ? { weekendCents } : {}),
      ...(publicHolidayCents ? { publicHolidayCents } : {}),
      ...(schoolHolidayCents ? { schoolHolidayCents } : {}),
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
      ...(travel ? { travel } : {}),
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
