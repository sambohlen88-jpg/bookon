import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, findCourseBySlug, schema, seed, type DbHandle } from "@bookon/db";
import { createClickToken } from "./click-token";
import { resolveGo } from "./go";

const KEY = "test-key";
const browser = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15";
const now = new Date("2026-10-16T23:00:00Z");

let handle: DbHandle;
let collier: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(schema.clickEvents);
});

const clubUrl =
  "https://bookings.collierparkgolf.com.au/guests/bookings/ViewPublicTimesheet.msp?bookingResourceId=3000000&selectedDate=2026-10-18&feeGroupId=1501783077";

function token(url = clubUrl, courseId = collier) {
  return createClickToken(
    { courseId, startTime: "2026-10-17T22:08:00.000Z", url, source: "search" },
    KEY,
  );
}

describe("resolveGo", () => {
  it("logs the click and forwards to the club", async () => {
    const result = await resolveGo(
      handle.db,
      token(),
      { sessionId: "s1", userAgent: browser, now },
      KEY,
    );
    expect(result).toEqual({ location: clubUrl, logged: true });
    const [click] = await handle.db.select().from(schema.clickEvents);
    expect(click).toMatchObject({ courseId: collier, anonymousSessionId: "s1", source: "search" });
    expect(click!.startTime?.toISOString()).toBe("2026-10-17T22:08:00.000Z");
  });

  it("forwards bots without counting them", async () => {
    const result = await resolveGo(
      handle.db,
      token(),
      { sessionId: null, userAgent: "Googlebot/2.1", now },
      KEY,
    );
    expect(result).toEqual({ location: clubUrl, logged: false });
    expect(await handle.db.select().from(schema.clickEvents)).toHaveLength(0);
  });

  it("never forwards to a site that isn't the course's booking site", async () => {
    const signedButForeign = token("https://evil.example/phish");
    expect(
      await resolveGo(
        handle.db,
        signedButForeign,
        { sessionId: "s1", userAgent: browser, now },
        KEY,
      ),
    ).toEqual({
      location: "/",
      logged: false,
    });
  });

  it("sends tampered or unknown links home", async () => {
    expect(
      (await resolveGo(handle.db, "bad.token", { sessionId: "s1", userAgent: browser, now }, KEY))
        .location,
    ).toBe("/");
    const unknownCourse = token(clubUrl, "00000000-0000-0000-0000-000000000000");
    expect(
      (await resolveGo(handle.db, unknownCourse, { sessionId: "s1", userAgent: browser, now }, KEY))
        .location,
    ).toBe("/");
  });
});
