import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { perthToUtc } from "@bookon/core";
import { createDb, recordPageView, setAnalyticsSettings, type DbHandle } from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import { analyticsUpkeep } from "./analytics";

class Inbox implements Mailer {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
}

let handle: DbHandle;
beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
});
afterAll(async () => {
  await handle.close();
});

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("the Monday summary", () => {
  it("emails last week's numbers once, on Monday morning, and can be turned off", async () => {
    const db = handle.db;
    // A visit on Saturday 17 October, from Google.
    await recordPageView(
      db,
      {
        visitorId: "v1",
        path: "/",
        referrer: "https://www.google.com/",
        ownHost: "bookon.au",
        utm: {},
        userAgent: IPHONE,
        width: 390,
        app: false,
        signedIn: false,
        country: null,
        region: null,
        city: null,
      },
      perthToUtc("2026-10-17", "09:00"),
    );
    const mail = new Inbox();
    const run = (date: string, time: string, adminEmail: string | null = "owner@example.com") =>
      analyticsUpkeep({
        db,
        mailer: mail,
        site: "https://bookon.test",
        now: perthToUtc(date, time),
        adminEmail,
      });

    expect((await run("2026-10-18", "09:00")).sent).toBe(false); // Sunday
    expect((await run("2026-10-19", "06:30")).sent).toBe(false); // Monday, too early
    expect((await run("2026-10-19", "07:05", null)).sent).toBe(false); // no admin set
    expect((await run("2026-10-19", "07:05")).sent).toBe(true);
    expect((await run("2026-10-19", "08:00")).sent).toBe(false); // once
    expect(mail.sent).toHaveLength(1);
    const email = mail.sent[0]!;
    expect(email.subject).toBe("BookOn last week: 1 visitor, 0 clicks to clubs");
    expect(email.text).toContain("Mon 12 Oct to Sun 18 Oct");
    expect(email.text).toContain("Visitors: 1 (none the week before)");
    expect(email.text).toContain("Search (1)");

    await setAnalyticsSettings(
      db,
      { weeklyEmail: false },
      { email: "owner@example.com", role: "admin" },
      new Date(),
    );
    expect((await run("2026-10-26", "07:05")).sent).toBe(false);
  });
});
