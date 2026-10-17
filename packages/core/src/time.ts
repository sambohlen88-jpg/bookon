/**
 * Perth time helpers. Western Australia has no daylight saving, so Perth is
 * always UTC+08:00. We store UTC and show Perth time to users.
 */
export const PERTH_TIME_ZONE = "Australia/Perth";
const PERTH_OFFSET = "+08:00";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Convert a Perth calendar date (YYYY-MM-DD) and wall-clock time (HH:mm) to a UTC Date. */
export function perthToUtc(date: string, time: string): Date {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  if (!TIME_RE.test(time)) throw new Error(`Invalid time: ${time}`);
  const result = new Date(`${date}T${time}:00${PERTH_OFFSET}`);
  if (Number.isNaN(result.getTime())) throw new Error(`Invalid date: ${date}`);
  return result;
}

/** The Perth calendar date (YYYY-MM-DD) for a UTC instant. */
export function perthDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** A short Perth time for display, e.g. "7:40 am". */
export function formatPerthTime(instant: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(instant);
}

/** Every Perth date from `from` to `to` inclusive. */
export function eachPerthDate(from: string, to: string): string[] {
  const start = perthToUtc(from, "12:00");
  const end = perthToUtc(to, "12:00");
  if (end < start) throw new Error(`Range ends before it starts: ${from} to ${to}`);
  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    days.push(perthDate(new Date(t)));
  }
  return days;
}

/** Add whole days to a Perth date. */
export function addPerthDays(date: string, days: number): string {
  return perthDate(new Date(perthToUtc(date, "12:00").getTime() + days * 24 * 60 * 60 * 1000));
}

/**
 * Parse a clock time as clubs write it ("6:07 AM", "06:00 am", "14:30") into
 * 24-hour "HH:mm". Returns null when it does not look like a time.
 */
export function parseClockTime(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(text.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (meridiem === "pm" && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
