/**
 * Reading club details from forms. Shared by onboarding (one step at a
 * time) and club logins (editing a live club).
 */
import {
  BOOKING_SYSTEMS,
  CLUB_KINDS,
  FACILITIES,
  checkRate,
  normaliseEmail,
  type BookingSystem,
  type ClubApplicationDetails,
  type ClubKind,
  type CourseInfo,
  type Facility,
  type Person,
  type RateInput,
} from "@bookon/db";

export type Parsed<T> = { value: T } | { error: string };

export const str = (form: FormData, name: string, max = 200): string | undefined => {
  const value = String(form.get(name) ?? "").trim();
  return value ? value.slice(0, max) : undefined;
};
const num = (form: FormData, name: string, min: number, max: number): number | undefined => {
  const value = Number(form.get(name));
  return form.get(name) && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
};
const time = (form: FormData, name: string): string | undefined => {
  const value = str(form, name, 5);
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
};
const yesNo = (form: FormData, name: string): boolean | undefined =>
  form.get(name) === "yes" ? true : form.get(name) === "no" ? false : undefined;

/** "lakeside.com.au" or "https://lakeside.com.au", as a full address. */
export function webAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function person(form: FormData, prefix: string): Person | undefined {
  const name = str(form, `${prefix}Name`, 120);
  const email = normaliseEmail(String(form.get(`${prefix}Email`) ?? "")) ?? undefined;
  const phone = str(form, `${prefix}Phone`, 40);
  const role = str(form, `${prefix}Role`, 80);
  if (!name && !email && !phone) return undefined;
  return { name: name ?? "", email: email ?? "", phone, role };
}

export function parseClub(form: FormData): Parsed<NonNullable<ClubApplicationDetails["club"]>> {
  const name = str(form, "name", 120);
  const suburb = str(form, "suburb", 80);
  if (!name || !suburb) return { error: "Add your club's name and suburb." };
  const abn = str(form, "abn", 20)?.replace(/\s/g, "");
  if (abn && !/^\d{11}$/.test(abn)) return { error: "An ABN has 11 digits." };
  const postcode = str(form, "postcode", 4);
  if (postcode && !/^\d{4}$/.test(postcode)) return { error: "A postcode has 4 digits." };
  const kind = str(form, "kind") as ClubKind | undefined;
  return {
    value: {
      name,
      legalName: str(form, "legalName", 160),
      abn,
      kind: kind && kind in CLUB_KINDS ? kind : undefined,
      website: webAddress(str(form, "website")),
      phone: str(form, "phone", 40),
      publicEmail: normaliseEmail(String(form.get("publicEmail") ?? "")) ?? undefined,
      street: str(form, "street", 160),
      suburb,
      postcode,
      state: str(form, "state", 3) ?? "WA",
    },
  };
}

export function parseContacts(
  form: FormData,
): Parsed<NonNullable<ClubApplicationDetails["contacts"]>> {
  const main = person(form, "main");
  if (!main?.name || !main.email) return { error: "Add a main contact's name and email." };
  return {
    value: {
      main,
      bookings: person(form, "bookings"),
      accounts: person(form, "accounts"),
      reportsEmail: normaliseEmail(String(form.get("reportsEmail") ?? "")) ?? undefined,
    },
  };
}

export function parseCourses(form: FormData): Parsed<CourseInfo[]> {
  let rows: unknown;
  try {
    rows = JSON.parse(String(form.get("courses") ?? "[]"));
  } catch {
    rows = [];
  }
  const courses: CourseInfo[] = (Array.isArray(rows) ? rows : [])
    .slice(0, 10)
    .map((r: Record<string, unknown>) => ({
      name: String(r.name ?? "")
        .trim()
        .slice(0, 120),
      holes: [9, 18, 27, 36].includes(Number(r.holes)) ? Number(r.holes) : 0,
      par: Number(r.par) >= 27 && Number(r.par) <= 80 ? Number(r.par) : undefined,
      layouts:
        String(r.layouts ?? "")
          .trim()
          .slice(0, 200) || undefined,
    }))
    .filter((c) => c.name);
  if (courses.length === 0) return { error: "Add at least one course." };
  if (courses.some((c) => !c.holes)) return { error: "Choose how many holes each course has." };
  return { value: courses };
}

export function parseTeeTimes(
  form: FormData,
): Parsed<NonNullable<ClubApplicationDetails["teeTimes"]>> {
  const bookingSystem = str(form, "bookingSystem") as BookingSystem | undefined;
  if (!bookingSystem || !(bookingSystem in BOOKING_SYSTEMS))
    return { error: "Choose how golfers book." };
  const bookingUrl = webAddress(str(form, "bookingUrl", 400));
  if (str(form, "bookingUrl") && !bookingUrl)
    return { error: "That booking page address doesn't look right." };
  return {
    value: {
      bookingSystem,
      bookingSystemOther: str(form, "bookingSystemOther", 120),
      bookingUrl,
      intervalMinutes: num(form, "intervalMinutes", 4, 30),
      weekdayFirst: time(form, "weekdayFirst"),
      weekdayLast: time(form, "weekdayLast"),
      weekendFirst: time(form, "weekendFirst"),
      weekendLast: time(form, "weekendLast"),
      windowDays: num(form, "windowDays", 1, 365),
      twoTeeStarts: yesNo(form, "twoTeeStarts"),
      maxPlayers: num(form, "maxPlayers", 1, 6),
      singlesWelcome: yesNo(form, "singlesWelcome"),
      memberTimes: str(form, "memberTimes", 1000),
      cancellationPolicy: str(form, "cancellationPolicy", 1000),
      dressCode: str(form, "dressCode", 500),
    },
  };
}

export function parseExtras(form: FormData): NonNullable<ClubApplicationDetails["extras"]> {
  return {
    description: str(form, "description", 800),
    facilities: form
      .getAll("facilities")
      .map(String)
      .filter((f): f is Facility => f in FACILITIES),
  };
}

/** The price list from the editor's hidden JSON field. */
export function parseRates(form: FormData): { rates: RateInput[] } | { problems: string[] } {
  let rows: unknown;
  try {
    rows = JSON.parse(String(form.get("rates") ?? "[]"));
  } catch {
    return { problems: ["Something went wrong reading the prices. Try again."] };
  }
  const checked = (Array.isArray(rows) ? rows : []).map((r) =>
    checkRate(r as Record<string, unknown>),
  );
  const problems = checked.flatMap((c) => ("problem" in c ? [c.problem] : []));
  if (problems.length > 0) return { problems };
  const rates = checked as RateInput[];
  if (!rates.some((r) => r.category === "green_fee")) {
    return { problems: ["Add at least one green fee, so golfers know what a round costs."] };
  }
  return { rates };
}
