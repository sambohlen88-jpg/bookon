import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  SIGN_IN_LINKS_PER_HOUR,
  clearVisits,
  consumeSignInToken,
  createSignInToken,
  deleteUser,
  endSession,
  listFavourites,
  listVisits,
  normaliseEmail,
  safeNextPath,
  setFavourite,
  userForSession,
} from "./accounts";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug } from "./queries";
import { createAlert, newNotificationId, recordAlertEmail } from "./alerts";
import { clickEvents, signInTokens, users } from "./schema";
import { seed } from "./seed";
import { logClick } from "./tracking";

const now = new Date("2026-10-16T23:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

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
  await handle.db.delete(clickEvents);
  await handle.db.delete(signInTokens);
  await handle.db.delete(users);
});

async function signIn(email = "sam@example.com", anonymousSessionId: string | null = null) {
  const link = await createSignInToken(handle.db, email, "/search?date=2026-10-18", now);
  if (!("token" in link)) throw new Error("rate limited");
  return consumeSignInToken(handle.db, link.token, anonymousSessionId, minutes(1));
}

describe("email and next path checks", () => {
  it("normalises email addresses", () => {
    expect(normaliseEmail("  Sam@Example.COM ")).toBe("sam@example.com");
    expect(normaliseEmail("not an email")).toBeNull();
  });

  it("only follows paths on this site", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example")).toBeNull();
  });
});

describe("sign-in links", () => {
  it("create the account on first use and sign the device in", async () => {
    const result = await signIn();
    expect(result!.user.email).toBe("sam@example.com");
    expect(result!.next).toBe("/search?date=2026-10-18");
    expect(await userForSession(handle.db, result!.sessionToken, minutes(2))).toMatchObject({
      email: "sam@example.com",
    });
  });

  it("work once only", async () => {
    const link = (await createSignInToken(handle.db, "sam@example.com", null, now)) as {
      token: string;
    };
    expect(await consumeSignInToken(handle.db, link.token, null, minutes(1))).not.toBeNull();
    expect(await consumeSignInToken(handle.db, link.token, null, minutes(2))).toBeNull();
  });

  it("expire after 15 minutes", async () => {
    const link = (await createSignInToken(handle.db, "sam@example.com", null, now)) as {
      token: string;
    };
    expect(await consumeSignInToken(handle.db, link.token, null, minutes(16))).toBeNull();
  });

  it("reuse the same account on later sign-ins", async () => {
    const first = await signIn();
    const second = await signIn();
    expect(second!.user.id).toBe(first!.user.id);
  });

  it("stop after five emails an hour per address", async () => {
    for (let i = 0; i < SIGN_IN_LINKS_PER_HOUR; i++) {
      expect(
        await createSignInToken(handle.db, "sam@example.com", null, minutes(i)),
      ).toHaveProperty("token");
    }
    expect(await createSignInToken(handle.db, "sam@example.com", null, minutes(10))).toEqual({
      error: "rate-limited",
    });
    expect(await createSignInToken(handle.db, "sam@example.com", null, minutes(61))).toHaveProperty(
      "token",
    );
  });

  it("sign out ends the device session", async () => {
    const result = await signIn();
    await endSession(handle.db, result!.sessionToken);
    expect(await userForSession(handle.db, result!.sessionToken, minutes(2))).toBeNull();
  });
});

describe("favourites", () => {
  it("can be added and removed", async () => {
    const { user } = (await signIn())!;
    await setFavourite(handle.db, user.id, collier, true, now);
    await setFavourite(handle.db, user.id, collier, true, now);
    expect((await listFavourites(handle.db, user.id)).map((c) => c.slug)).toEqual(["collier-park"]);
    await setFavourite(handle.db, user.id, collier, false, now);
    expect(await listFavourites(handle.db, user.id)).toEqual([]);
  });
});

describe("previous visits", () => {
  it("include this device's clicks from before signing in", async () => {
    await logClick(handle.db, {
      sessionId: "device-1",
      courseId: collier,
      startTime: now,
      source: "search",
      now,
    });
    const { user } = (await signIn("sam@example.com", "device-1"))!;
    const visits = await listVisits(handle.db, user.id);
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ courseSlug: "collier-park", source: "search" });
  });

  it("can be cleared without losing the club's click counts", async () => {
    await logClick(handle.db, {
      sessionId: "device-1",
      courseId: collier,
      startTime: now,
      source: "search",
      now,
    });
    const { user } = (await signIn("sam@example.com", "device-1"))!;
    await clearVisits(handle.db, user.id);
    expect(await listVisits(handle.db, user.id)).toEqual([]);
    expect(await handle.db.select().from(clickEvents)).toHaveLength(1);
  });
});

describe("deleteUser", () => {
  it("removes the account but keeps anonymous click counts", async () => {
    await logClick(handle.db, {
      sessionId: "device-1",
      courseId: collier,
      startTime: now,
      source: "search",
      now,
    });
    const { user, sessionToken } = (await signIn("sam@example.com", "device-1"))!;
    await setFavourite(handle.db, user.id, collier, true, now);
    await deleteUser(handle.db, user.id);
    expect(await userForSession(handle.db, sessionToken, minutes(2))).toBeNull();
    expect(await handle.db.select().from(users)).toEqual([]);
    const [click] = await handle.db.select().from(clickEvents);
    expect(click!.userId).toBeNull();
  });

  it("works after the golfer clicked a link in an alert email", async () => {
    const { user } = (await signIn("ali@example.com", "device-2"))!;
    const created = await createAlert(handle.db, {
      userId: user.id,
      email: user.email,
      filters: {
        dateFrom: "2026-10-18",
        dateTo: "2026-10-18",
        timeFrom: "06:00",
        timeTo: "12:00",
        players: 2,
        holes: null,
        courseSlugs: [],
      },
      now,
    });
    const alertId = "alert" in created ? created.alert.id : "";
    const notificationId = newNotificationId();
    await recordAlertEmail(
      handle.db,
      alertId,
      [{ id: notificationId, courseId: collier, startTime: now, holes: 18, clickToken: "t" }],
      now,
    );
    await logClick(handle.db, {
      sessionId: "device-2",
      userId: user.id,
      courseId: collier,
      startTime: now,
      source: "alert",
      notificationId,
      now,
    });

    await deleteUser(handle.db, user.id);
    const clicks = await handle.db.select().from(clickEvents);
    const click = clicks.find((c) => c.anonymousSessionId === "device-2");
    expect(click).toMatchObject({ source: "alert", userId: null, notificationId: null });
  });
});
