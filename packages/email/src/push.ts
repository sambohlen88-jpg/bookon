import webpush from "web-push";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import { getSetting, setSettingOnce, type AlertMatch, type Database } from "@bookon/db";

/** What the service worker shows. `url` opens when the golfer taps it. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** A newer notification with the same tag replaces the old one, so alerts don't pile up. */
  tag: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const DEV_KEYS_SETTING = "vapid-dev-keys";

/**
 * The key pair that signs push messages. In production it must come from
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Locally, a pair is made once and
 * kept in the database, so the website and worker agree without any setup.
 */
export async function vapidKeys(
  db: Database,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VapidKeys | null> {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  }
  if (env.NODE_ENV === "production") return null;
  return (
    (await getSetting<VapidKeys>(db, DEV_KEYS_SETTING)) ??
    (await setSettingOnce(db, DEV_KEYS_SETTING, webpush.generateVAPIDKeys()))
  );
}

/**
 * Sends with the standard Web Push protocol (RFC 8291 encryption, RFC 8292
 * VAPID). web-push builds the request; fetch sends it, so proxies work.
 */
export class WebPushSender implements PushSender {
  constructor(
    private readonly keys: VapidKeys,
    private readonly subject = "mailto:info@bookon.au",
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    let request: ReturnType<typeof webpush.generateRequestDetails>;
    try {
      request = webpush.generateRequestDetails(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: {
            subject: this.subject,
            publicKey: this.keys.publicKey,
            privateKey: this.keys.privateKey,
          },
          // Tee times go fast: drop the message if the phone is off for more than 2 hours.
          TTL: 2 * 60 * 60,
          urgency: "high",
          topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
        },
      );
    } catch (error) {
      // Keys the push service gave are malformed: the subscription can never work.
      return { ok: false, gone: true, error: String(error) };
    }
    try {
      const response = await this.fetchImpl(request.endpoint, {
        method: request.method,
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([name, value]) => [name, String(value)]),
        ),
        body: request.body ? new Uint8Array(request.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return { ok: true };
      return {
        ok: false,
        // 404 and 410: the subscription has expired or been removed.
        gone: response.status === 404 || response.status === 410,
        error: `HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      };
    } catch (error) {
      return { ok: false, gone: false, error: String(error) };
    }
  }
}

/** The short message for new tee times on an alert. */
export function alertPushPayload(input: {
  alertId: string;
  matches: AlertMatch[];
  url: string;
}): PushPayload {
  const matches = [...input.matches].sort(
    (a, b) => a.teeTime.startTime.getTime() - b.teeTime.startTime.getTime(),
  );
  const first = matches[0]!;
  const courses = [...new Set(matches.map((m) => m.course.name))];
  const when = (m: AlertMatch) =>
    `${formatPerthDay(perthDate(m.teeTime.startTime))} ${formatPerthTime(m.teeTime.startTime)}`;
  if (matches.length === 1) {
    const t = first.teeTime;
    const spots = `${t.spotsAvailable} ${t.spotsAvailable === 1 ? "spot" : "spots"}`;
    const price = t.priceCents === null ? "" : ` · ${formatPrice(t.priceCents)}`;
    return {
      title: `New tee time: ${first.course.name}`,
      body: `${when(first)} · ${t.holes} holes · ${spots}${price}`,
      url: input.url,
      tag: `alert-${input.alertId}`,
    };
  }
  return {
    title: `${matches.length} new tee times`,
    body:
      courses.length === 1
        ? `${courses[0]}, from ${when(first)}`
        : `At ${courses.length} courses, from ${when(first)}`,
    url: input.url,
    tag: `alert-${input.alertId}`,
  };
}
