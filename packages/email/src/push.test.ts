import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import webpush from "web-push";
import type { AlertMatch } from "@bookon/db";
import { WebPushSender, alertPushPayload } from "./push";

/** A browser's subscription keys, made the way a browser makes them. */
function subscriber() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: "https://push.example/send/abc",
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

function match(course: string, perthIso: string, spots = 4): AlertMatch {
  return {
    course: { id: course, slug: course, name: course, suburb: "" },
    teeTime: {
      startTime: new Date(`${perthIso}+08:00`),
      playDate: perthIso.slice(0, 10),
      holes: 18,
      layout: null,
      spotsAvailable: spots,
      priceCents: 4000,
      bookingUrl: "https://example.com",
    },
  } as AlertMatch;
}

describe("alertPushPayload", () => {
  it("names the course and time for one new tee time", () => {
    expect(
      alertPushPayload({
        alertId: "a1",
        matches: [match("Collier Park", "2026-10-18T07:30:00", 1)],
        url: "https://bookon.test/alerts/t?new=1",
      }),
    ).toEqual({
      title: "New tee time: Collier Park",
      body: "Sun 18 Oct 7:30 am · 18 holes · 1 spot · $40",
      url: "https://bookon.test/alerts/t?new=1",
      tag: "alert-a1",
    });
  });

  it("sums up several, from the earliest", () => {
    const payload = alertPushPayload({
      alertId: "a1",
      matches: [
        match("Whaleback", "2026-10-18T09:00:00"),
        match("Collier Park", "2026-10-18T07:30:00"),
      ],
      url: "u",
    });
    expect(payload.title).toBe("2 new tee times");
    expect(payload.body).toBe("At 2 courses, from Sun 18 Oct 7:30 am");
  });
});

describe("WebPushSender", () => {
  const keys = webpush.generateVAPIDKeys();
  const payload = { title: "t", body: "b", url: "/", tag: "alert-1" };

  it("sends an encrypted, signed message to the push service", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const sender = new WebPushSender(keys, "mailto:info@bookon.com.au", (async (
      url: string,
      init: RequestInit,
    ) => {
      sent = { url, init };
      return new Response(null, { status: 201 });
    }) as typeof fetch);
    expect(await sender.send(subscriber(), payload)).toEqual({ ok: true });
    const { url, init } = sent!;
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://push.example/send/abc");
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(headers.TTL).toBe("7200");
    expect(headers.Urgency).toBe("high");
    // Encrypted: the message text isn't readable on the wire.
    expect(Buffer.from(init.body as Uint8Array).toString()).not.toContain('"title"');
  });

  it("reports devices that have gone", async () => {
    const answer = (status: number) =>
      new WebPushSender(
        keys,
        "mailto:x@y.z",
        (async () => new Response("nope", { status })) as unknown as typeof fetch,
      );
    expect(await answer(410).send(subscriber(), payload)).toMatchObject({
      ok: false,
      gone: true,
    });
    expect(await answer(404).send(subscriber(), payload)).toMatchObject({ gone: true });
    expect(await answer(500).send(subscriber(), payload)).toMatchObject({ gone: false });
  });

  it("treats a subscription with broken keys as gone", async () => {
    const sender = new WebPushSender(
      keys,
      "mailto:x@y.z",
      (async () => new Response(null, { status: 201 })) as unknown as typeof fetch,
    );
    expect(
      await sender.send(
        { endpoint: "https://push.example/x", p256dh: "bad", auth: "bad" },
        payload,
      ),
    ).toMatchObject({ ok: false, gone: true });
  });
});
