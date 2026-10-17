/** Anonymous visitor id: a random UUID, never linked to a name or email. */
export const SESSION_COOKIE = "bookon_sid";
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only accept ids we could have issued, so the logs can't be stuffed with junk. */
export function validSessionId(value: string | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}
