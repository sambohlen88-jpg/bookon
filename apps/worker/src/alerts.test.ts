import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readClickToken, type TeeTime } from "@bookon/core";
import {
  createAlert,
  createDb,
  findCourseBySlug,
  saveDayAvailability,
  schema,
  seed,
  type DbHandle,
  type SearchParams,
} from "@bookon/db";
import type { EmailMessage, Mailer } from "@bookon/email";
import { sendAlertEmails } from "./alerts";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const site = "https://bookon.test";
const key = "test-signing-key";

const filters: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: null,
  courseSlugs: ["collier-park"],
};

class TestMailer implements Mailer {
  sent: EmailMessage[] = [];
  fail = false;
  async send(message: EmailMessage) {
    if (this.fail) throw new Error("mail server down");
    this.sent.push(message);
  }
}

let handle: DbHandle;
let collier: string;
let mailer: TestMailer;

function slot(perthTime: string): TeeTime {
  return {
    courseId: collier,
    startTime: new Date(`2026-10-18T${perthTime}:00+08:00`),
    holes: 18,
    layout: null,
    spotsAvailable: 4,
    minPlayers: 1,
    priceCents: 4000,
    sourceUrl: "https://bookings.collierparkgolf.com.au/x",
    bookingUrl: "https://bookings.collierparkgolf.com.au/x",
  };
}

beforeEach(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
  mailer = new TestMailer();
  await saveDayAvailability(handle.db, collier, "2026-10-18", [slot("08:00")], now);
  const [user] = await handle.db
    .insert(schema.users)
    .values({ email: "sam@example.com" })
    .returning();
  await createAlert(handle.db, { userId: user!.id, email: "sam@example.com", filters, now });
});

afterEach(async () => {
  await handle.close();
});

describe("sendAlertEmails", () => {
  it("emails a new tee time once, with a tracked link and a manage link", async () => {
    expect(await sendAlertEmails(handle.db, mailer, { now: later(1), site, key })).toEqual({
      ended: 0,
      sent: 0,
      failed: 0,
    });

    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("08:00"), slot("09:00")],
      later(30),
    );
    const result = await sendAlertEmails(handle.db, mailer, { now: later(31), site, key });
    expect(result.sent).toBe(1);
    const [email] = mailer.sent;
    expect(email!.to).toBe("sam@example.com");
    expect(email!.subject).toContain("9:00 am");
    expect(email!.text).toContain(`${site}/alerts/`);

    const token = /\/go\/(\S+)/.exec(email!.text)![1]!;
    expect(readClickToken(token, key)).toMatchObject({
      courseId: collier,
      source: "alert",
      url: "https://bookings.collierparkgolf.com.au/x",
    });
    const emailed = (await handle.db.select().from(schema.notifications)).filter(
      (n) => !n.baseline,
    );
    expect(emailed).toHaveLength(1);
    expect(emailed[0]!.clickToken).toBe(token);

    // Still showing two hours later: not sent again.
    await sendAlertEmails(handle.db, mailer, { now: later(150), site, key });
    expect(mailer.sent).toHaveLength(1);
  });

  it("tries again next time when sending fails", async () => {
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("08:00"), slot("09:00")],
      later(30),
    );
    mailer.fail = true;
    expect(await sendAlertEmails(handle.db, mailer, { now: later(31), site, key })).toMatchObject({
      sent: 0,
      failed: 1,
    });
    mailer.fail = false;
    expect(await sendAlertEmails(handle.db, mailer, { now: later(32), site, key })).toMatchObject({
      sent: 1,
    });
  });

  it("links straight to the club when there is no signing key", async () => {
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("08:00"), slot("09:00")],
      later(30),
    );
    await sendAlertEmails(handle.db, mailer, { now: later(31), site, key: null });
    expect(mailer.sent[0]!.text).toContain("Book: https://bookings.collierparkgolf.com.au/x");
    expect(mailer.sent[0]!.text).not.toContain("/go/");
  });

  it("ends alerts once their last day has passed", async () => {
    const nextWeek = new Date("2026-10-20T00:00:00Z");
    expect(await sendAlertEmails(handle.db, mailer, { now: nextWeek, site, key })).toEqual({
      ended: 1,
      sent: 0,
      failed: 0,
    });
  });
});
