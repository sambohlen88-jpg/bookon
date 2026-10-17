import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAlert } from "./alerts";
import { createDb, type DbHandle } from "./client";
import {
  enablePushForAlerts,
  getSetting,
  listPushSubscriptions,
  removePushSubscription,
  savePushSubscription,
  setAlertChannels,
  setSettingOnce,
  validPushEndpoint,
} from "./push";
import { alerts, users } from "./schema";
import { seed } from "./seed";

const now = new Date("2026-10-16T23:00:00Z");
let handle: DbHandle;
let sam: string;
let ali: string;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(users);
  const rows = await handle.db
    .insert(users)
    .values([{ email: "sam@example.com" }, { email: "ali@example.com" }])
    .returning();
  sam = rows[0]!.id;
  ali = rows[1]!.id;
});

const device = {
  endpoint: "https://push.example/1",
  p256dh: "k",
  auth: "a",
  deviceLabel: "iPhone",
};

describe("push subscriptions", () => {
  it("only accept https push service addresses", () => {
    expect(validPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(validPushEndpoint("http://169.254.169.254/latest")).toBe(false);
    expect(validPushEndpoint("not a url")).toBe(false);
  });

  it("belong to whoever signed in on the device last", async () => {
    await savePushSubscription(handle.db, sam, device, now);
    await savePushSubscription(handle.db, sam, device, now);
    expect(await listPushSubscriptions(handle.db, sam)).toHaveLength(1);

    await savePushSubscription(handle.db, ali, device, now);
    expect(await listPushSubscriptions(handle.db, sam)).toHaveLength(0);
    expect(await listPushSubscriptions(handle.db, ali)).toHaveLength(1);
  });

  it("can only be removed by their owner", async () => {
    await savePushSubscription(handle.db, sam, device, now);
    await removePushSubscription(handle.db, ali, device.endpoint);
    expect(await listPushSubscriptions(handle.db, sam)).toHaveLength(1);
    await removePushSubscription(handle.db, sam, device.endpoint);
    expect(await listPushSubscriptions(handle.db, sam)).toHaveLength(0);
  });
});

describe("alert channels", () => {
  it("keep at least one way to reach the golfer, and push turns on for every alert", async () => {
    const created = await createAlert(handle.db, {
      userId: sam,
      email: "sam@example.com",
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
    const id = "alert" in created ? created.alert.id : "";
    const read = async () => (await handle.db.select().from(alerts)).find((a) => a.id === id)!;
    expect(await read()).toMatchObject({ notifyEmail: true, notifyPush: false });

    await enablePushForAlerts(handle.db, sam);
    expect(await read()).toMatchObject({ notifyEmail: true, notifyPush: true });
    await setAlertChannels(handle.db, id, { email: false, push: true });
    expect(await read()).toMatchObject({ notifyEmail: false, notifyPush: true });
    await setAlertChannels(handle.db, id, { email: false, push: false });
    expect(await read()).toMatchObject({ notifyEmail: false, notifyPush: true });
  });
});

describe("settings", () => {
  it("keep the first value stored", async () => {
    expect(await getSetting(handle.db, "k")).toBeNull();
    expect(await setSettingOnce(handle.db, "k", { a: 1 })).toEqual({ a: 1 });
    expect(await setSettingOnce(handle.db, "k", { a: 2 })).toEqual({ a: 1 });
  });
});
