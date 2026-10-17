import { describe, expect, it } from "vitest";
import { bookLink, createClickToken, readClickToken, type ClickTarget } from "./click-token";

const target: ClickTarget = {
  courseId: "6f1c2a9e-0000-4000-8000-000000000001",
  startTime: "2026-10-17T22:08:00.000Z",
  url: "https://bookings.collierparkgolf.com.au/guests/bookings/ViewPublicTimesheet.msp?selectedDate=2026-10-18",
  source: "search",
};

describe("click tokens", () => {
  it("round-trip", () => {
    expect(readClickToken(createClickToken(target, "k1"), "k1")).toEqual({
      ...target,
      notificationId: null,
    });
  });

  it("carry the alert email a click came from", () => {
    const fromAlert = { ...target, source: "alert" as const, notificationId: "n-1" };
    expect(readClickToken(createClickToken(fromAlert, "k1"), "k1")).toEqual(fromAlert);
  });

  it("reject a token signed with another key", () => {
    expect(readClickToken(createClickToken(target, "k1"), "k2")).toBeNull();
  });

  it("reject a token whose destination was changed", () => {
    const token = createClickToken(target, "k1");
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        c: target.courseId,
        t: target.startTime,
        u: "https://evil.example/",
        s: "search",
      }),
    ).toString("base64url");
    expect(readClickToken(`${forged}.${signature}`, "k1")).toBeNull();
  });

  it("reject junk", () => {
    expect(readClickToken("nonsense", "k1")).toBeNull();
    expect(readClickToken("a.b.c", "k1")).toBeNull();
    expect(readClickToken("", "k1")).toBeNull();
  });
});

describe("bookLink", () => {
  it("goes through /go when a key is set", () => {
    expect(bookLink(target, "k1")).toMatch(/^\/go\/[\w-]+\.[\w-]+$/);
  });

  it("falls back to the club's own link without a key, so golfers can still book", () => {
    expect(bookLink(target, null)).toBe(target.url);
  });
});
