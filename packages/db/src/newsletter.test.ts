import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeSignInToken, createSignInToken, deleteUser } from "./accounts";
import { createDb, type DbHandle } from "./client";
import {
  NEWSLETTER_CONSENT,
  isSubscribed,
  listNewsletterSubscribers,
  markNewsletterSynced,
  newsletterChangesToSync,
  newsletterSummary,
  subscribeNewsletter,
  unsubscribeNewsletter,
} from "./newsletter";

const now = new Date("2026-10-27T02:00:00Z");
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
let handle: DbHandle;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
});
afterAll(async () => {
  await handle.close();
});

describe("newsletter (Milestone 27)", () => {
  it("adds someone only once their sign-in link is used, if they ticked the box", async () => {
    const db = handle.db;
    const ticked = await createSignInToken(db, "keen@example.com", null, now, true);
    const plain = await createSignInToken(db, "quiet@example.com", null, now);
    expect(await isSubscribed(db, "keen@example.com")).toBe(false);
    await consumeSignInToken(db, (ticked as { token: string }).token, null, later(1));
    await consumeSignInToken(db, (plain as { token: string }).token, null, later(1));
    expect(await isSubscribed(db, "keen@example.com")).toBe(true);
    expect(await isSubscribed(db, "quiet@example.com")).toBe(false);
    const [row] = await listNewsletterSubscribers(db);
    expect(row).toMatchObject({
      email: "keen@example.com",
      source: "signin",
      consentText: NEWSLETTER_CONSENT,
      consentedAt: later(1),
    });
  });

  it("queues each change for Mailchimp, and keeps problems to retry", async () => {
    const db = handle.db;
    await subscribeNewsletter(db, { email: "Lesson@Example.com", source: "lesson", now: later(2) });
    const waiting = await newsletterChangesToSync(db);
    expect(waiting.map((w) => w.email)).toEqual(["keen@example.com", "lesson@example.com"]);
    await markNewsletterSynced(db, waiting[0]!.id, later(3), null);
    await markNewsletterSynced(db, waiting[1]!.id, later(3), "Mailchimp said no");
    expect((await newsletterChangesToSync(db)).map((w) => w.email)).toEqual(["lesson@example.com"]);
    expect(await newsletterSummary(db)).toMatchObject({ subscribed: 2, waiting: 1, problems: 1 });

    // Unsubscribing in My account is a new change to send.
    await unsubscribeNewsletter(db, { email: "keen@example.com", via: "account", now: later(4) });
    expect((await newsletterChangesToSync(db)).map((w) => w.email)).toContain("keen@example.com");
  });

  it("doesn't send Mailchimp's own changes back to it", async () => {
    const db = handle.db;
    await subscribeNewsletter(db, {
      email: "form@example.com",
      source: "mailchimp",
      now: later(5),
      synced: true,
    });
    await subscribeNewsletter(db, { email: "gone@example.com", source: "event", now: later(5) });
    const gone = (await newsletterChangesToSync(db)).find((w) => w.email === "gone@example.com")!;
    await markNewsletterSynced(db, gone.id, later(5), null);
    await unsubscribeNewsletter(db, { email: "gone@example.com", via: "mailchimp", now: later(6) });
    const emails = (await newsletterChangesToSync(db)).map((w) => w.email);
    expect(emails).not.toContain("form@example.com");
    expect(emails).not.toContain("gone@example.com");
    expect(await isSubscribed(db, "gone@example.com")).toBe(false);
  });

  it("takes a deleted account off the list, but remembers not to add it back", async () => {
    const db = handle.db;
    const link = await createSignInToken(db, "leaving@example.com", null, now, true);
    const signedIn = await consumeSignInToken(
      db,
      (link as { token: string }).token,
      null,
      later(7),
    );
    await deleteUser(db, signedIn!.user.id);
    const rows = await listNewsletterSubscribers(db);
    expect(rows.find((r) => r.email === "leaving@example.com")).toMatchObject({
      status: "unsubscribed",
      unsubscribedVia: "account-deleted",
    });
  });
});
