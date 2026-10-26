import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { TeeTime } from "@bookon/core";
import {
  MAX_ALERTS_PER_GOLFER,
  alertByManageToken,
  createAlert,
  endExpiredAlerts,
  findNewAlertMatches,
  listAlerts,
  newNotificationId,
  recordAlertRound,
  setAlertStatus,
  updateAlert,
} from "./alerts";
import { createDb, type DbHandle } from "./client";
import { findCourseBySlug, saveDayAvailability } from "./queries";
import { alerts, availabilityChecks, availabilitySnapshots, users } from "./schema";
import { listSearchableCourses, searchTeeTimes, withinReach, type SearchParams } from "./search";
import { seed } from "./seed";

// 7:00 am Perth, Saturday 17 October 2026.
const now = new Date("2026-10-16T23:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

let handle: DbHandle;
let collier: string;
let userId: string;

const filters: SearchParams = {
  dateFrom: "2026-10-18",
  dateTo: "2026-10-18",
  timeFrom: "06:00",
  timeTo: "12:00",
  players: 2,
  holes: null,
  courseSlugs: ["collier-park"],
};

function slot(perthIso: string): TeeTime {
  return {
    courseId: collier,
    startTime: new Date(`${perthIso}+08:00`),
    holes: 18,
    layout: null,
    spotsAvailable: 4,
    minPlayers: 1,
    priceCents: 4000,
    sourceUrl: "https://example.com",
    bookingUrl: "https://bookings.collierparkgolf.com.au/x",
  };
}

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
  await handle.db.delete(alerts);
  await handle.db.delete(users);
  await handle.db.delete(availabilitySnapshots);
  await handle.db.delete(availabilityChecks);
  const [user] = await handle.db.insert(users).values({ email: "sam@example.com" }).returning();
  userId = user!.id;
});

describe("alerts", () => {
  it("only report tee times that appear after the alert was set up", async () => {
    await saveDayAvailability(handle.db, collier, "2026-10-18", [slot("2026-10-18T08:00:00")], now);
    await createAlert(handle.db, { userId, email: "sam@example.com", filters, now });
    expect(await findNewAlertMatches(handle.db, minutes(1))).toEqual([]);

    // A cancellation frees up 9:00.
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("2026-10-18T08:00:00"), slot("2026-10-18T09:00:00")],
      minutes(30),
    );
    const found = await findNewAlertMatches(handle.db, minutes(31));
    expect(found).toHaveLength(1);
    expect(found[0]!.matches.map((m) => m.teeTime.startTime.toISOString())).toEqual([
      "2026-10-18T01:00:00.000Z",
    ]);
  });

  it("email each slot once, and at most one email an hour", async () => {
    const { alert } = (await createAlert(handle.db, {
      userId,
      email: "sam@example.com",
      filters,
      now,
    })) as {
      alert: { id: string };
    };
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("2026-10-18T09:00:00")],
      minutes(30),
    );
    const [first] = await findNewAlertMatches(handle.db, minutes(31));
    const match = first!.matches[0]!;
    await recordAlertRound(
      handle.db,
      alert.id,
      [
        {
          id: newNotificationId(),
          courseId: collier,
          startTime: match.teeTime.startTime,
          holes: 18,
          clickToken: "t1",
        },
      ],
      minutes(31),
    );

    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("2026-10-18T09:00:00"), slot("2026-10-18T10:00:00")],
      minutes(60),
    );
    // Within the hour: wait.
    expect(await findNewAlertMatches(handle.db, minutes(61))).toEqual([]);
    // After it: only the new 10:00 slot (data must still be fresh, so re-save).
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("2026-10-18T09:00:00"), slot("2026-10-18T10:00:00")],
      minutes(95),
    );
    const [later] = await findNewAlertMatches(handle.db, minutes(95));
    expect(later!.matches.map((m) => m.teeTime.startTime.toISOString())).toEqual([
      "2026-10-18T02:00:00.000Z",
    ]);
  });

  it("stay quiet while paused", async () => {
    const { alert } = (await createAlert(handle.db, {
      userId,
      email: "sam@example.com",
      filters,
      now,
    })) as {
      alert: { id: string; manageToken: string };
    };
    await setAlertStatus(handle.db, alert.id, "paused");
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-18",
      [slot("2026-10-18T09:00:00")],
      minutes(30),
    );
    expect(await findNewAlertMatches(handle.db, minutes(31))).toEqual([]);
    expect((await alertByManageToken(handle.db, alert.manageToken))!.status).toBe("paused");
  });

  it("end once their dates have passed", async () => {
    await createAlert(handle.db, { userId, email: "sam@example.com", filters, now });
    // 6 pm on the 18th in Perth: still the alert's last day.
    expect(await endExpiredAlerts(handle.db, new Date("2026-10-18T10:00:00Z"))).toBe(0);
    // 12:30 am on the 19th in Perth.
    expect(await endExpiredAlerts(handle.db, new Date("2026-10-18T16:30:00Z"))).toBe(1);
    const [ended] = await listAlerts(handle.db, userId);
    expect(ended!.status).toBe("ended");
    await setAlertStatus(handle.db, ended!.id, "active");
    expect((await listAlerts(handle.db, userId))[0]!.status).toBe("ended");
  });

  it("are capped per golfer", async () => {
    for (let i = 0; i < MAX_ALERTS_PER_GOLFER; i++) {
      expect(
        await createAlert(handle.db, { userId, email: "sam@example.com", filters, now }),
      ).toHaveProperty("alert");
    }
    expect(
      await createAlert(handle.db, { userId, email: "sam@example.com", filters, now }),
    ).toEqual({ error: "limit" });
  });
});

describe("near me alerts and editing (Milestone 28)", () => {
  // Claremont, rounded as the browser's location is.
  const claremont = { latitude: -31.98, longitude: 115.78 };

  it("reaches Kennedy Bay at 50 km from Claremont, but never Albany or Broome", async () => {
    const courses = await listSearchableCourses(handle.db);
    const near = (withinKm: number) =>
      withinReach(courses, { ...claremont, withinKm }).map((c) => c.slug);
    expect(near(30)).toContain("collier-park");
    expect(near(30)).not.toContain("kennedy-bay");
    expect(near(50)).toContain("kennedy-bay");
    expect(near(100)).not.toContain("albany");
    expect(near(100)).not.toContain("broome");
  });

  it("only searches courses within reach", async () => {
    await saveDayAvailability(handle.db, collier, "2026-10-18", [slot("2026-10-18T08:00:00")], now);
    const base = { ...filters, courseSlugs: null };
    const close = await findNear({ ...base, near: { ...claremont, withinKm: 30 } });
    const far = await findNear({
      ...base,
      near: { latitude: -35.0, longitude: 117.9, withinKm: 30 },
    });
    expect(close).toContain("collier-park");
    expect(far).not.toContain("collier-park");
  });

  it("edits an alert without sending times it already knew, and restarts an ended one", async () => {
    const [user] = await handle.db
      .insert(users)
      .values({ email: "editor@example.com" })
      .returning();
    const made = await createAlert(handle.db, {
      userId: user!.id,
      email: "editor@example.com",
      filters,
      now,
    });
    const alert = (made as { alert: { id: string } }).alert;
    // Nobody else can change it.
    const [other] = await handle.db
      .insert(users)
      .values({ email: "someone.else@example.com" })
      .returning();
    expect(
      await updateAlert(handle.db, { alertId: alert.id, userId: other!.id, filters, now }),
    ).toBe(false);
    await handle.db.update(alerts).set({ status: "ended" }).where(eq(alerts.id, alert.id));
    const changed = { ...filters, timeFrom: "07:00", dateTo: "2026-10-19" };
    expect(
      await updateAlert(handle.db, { alertId: alert.id, userId: user!.id, filters: changed, now }),
    ).toBe(true);
    const [after] = await listAlerts(handle.db, user!.id);
    expect(after).toMatchObject({ status: "active", filters: changed });
  });
});

async function findNear(params: SearchParams): Promise<string[]> {
  const result = await searchTeeTimes(handle.db, params, now);
  return result.courses.map((c) => c.course.slug);
}
