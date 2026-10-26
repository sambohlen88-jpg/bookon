import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  newsletterChangesToSync,
  newsletterSummary,
  subscribeNewsletter,
  unsubscribeNewsletter,
  type DbHandle,
} from "@bookon/db";
import type { MarketingList } from "@bookon/email";
import { syncNewsletter } from "./newsletter";

const now = new Date("2026-10-27T02:00:00Z");
let handle: DbHandle;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
});
afterAll(async () => {
  await handle.close();
});

describe("syncNewsletter (Milestone 27)", () => {
  it("sends each change once, and keeps failures to try again", async () => {
    const db = handle.db;
    await subscribeNewsletter(db, { email: "a@example.com", source: "signin", now });
    await subscribeNewsletter(db, { email: "b@example.com", source: "lesson", now });
    const sent: string[] = [];
    let down = true;
    const list: MarketingList = {
      async setStatus(email, status) {
        if (email === "b@example.com" && down) throw new Error("Mailchimp: HTTP 503");
        sent.push(`${email} ${status}`);
        return "done";
      },
    };
    expect(await syncNewsletter(db, list)).toEqual({ synced: 1, pending: 0, failed: 1 });
    expect((await newsletterSummary(db)).problems).toBe(1);

    down = false;
    await unsubscribeNewsletter(db, {
      email: "a@example.com",
      via: "account",
      now: new Date(now.getTime() + 60_000),
    });
    expect(await syncNewsletter(db, list)).toEqual({ synced: 2, pending: 0, failed: 0 });
    expect(sent).toEqual([
      "a@example.com subscribed",
      "b@example.com subscribed",
      "a@example.com unsubscribed",
    ]);
    expect(await newsletterChangesToSync(db)).toEqual([]);
  });
});
