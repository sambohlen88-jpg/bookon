import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client";
import { addClubMember } from "./admin";
import { saveCoachDraft } from "./coaches";
import { clubs, users } from "./schema";
import { seed } from "./seed";
import { deleteUserForAdmin, listUsersForAdmin, userForAdmin } from "./users";

const now = new Date("2026-10-19T02:00:00Z");
const admin = { email: "sam@bookon.test", role: "admin" as const };
let handle: DbHandle;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const db = handle.db;
  await db.insert(users).values([
    { email: "sam@bookon.test", createdAt: new Date("2026-10-01T00:00:00Z") },
    { email: "golfer@example.com", createdAt: new Date("2026-10-02T00:00:00Z") },
    { email: "owner@club.test", createdAt: new Date("2026-10-03T00:00:00Z") },
    { email: "coach@example.com", createdAt: new Date("2026-10-04T00:00:00Z") },
  ]);
  const [club] = await db.select().from(clubs).limit(1);
  await addClubMember(db, club!.id, "owner@club.test", "owner", admin, now);
  await addClubMember(db, club!.id, "golfer@example.com", "staff", admin, now);
  await saveCoachDraft(
    db,
    "coach@example.com",
    {
      name: "Casey Coach",
      headline: "",
      bio: "",
      specialities: [],
      rates: [],
      hours: [],
      away: [],
      places: [],
      suburb: "",
      area: "",
      contact: {},
    },
    now,
  );
});
afterAll(async () => {
  await handle.close();
});

describe("listUsersForAdmin", () => {
  it("lists everyone newest first, with groups from what they can do", async () => {
    const list = await listUsersForAdmin(handle.db, "sam@bookon.test");
    expect(list.map((u) => [u.email, u.groups])).toEqual([
      ["coach@example.com", ["customer", "coach"]],
      ["owner@club.test", ["customer", "club-owner"]],
      ["golfer@example.com", ["customer", "club-staff"]],
      ["sam@bookon.test", ["customer", "admin"]],
    ]);
    expect(list[0]!.coach).toMatchObject({ name: "Casey Coach", status: "new" });
    expect(list[1]!.clubs).toHaveLength(1);
  });

  it("has no admin when none is set", async () => {
    const list = await listUsersForAdmin(handle.db, null);
    expect(list.some((u) => u.groups.includes("admin"))).toBe(false);
  });
});

describe("deleteUserForAdmin", () => {
  it("deletes the account but leaves club access to the club", async () => {
    const db = handle.db;
    const golfer = (await listUsersForAdmin(db, null)).find(
      (u) => u.email === "golfer@example.com",
    )!;
    await deleteUserForAdmin(db, golfer, admin, now);
    expect(await userForAdmin(db, golfer.id, null)).toBeNull();
    // Signing up again with that email would still give them club staff access.
    expect((await listUsersForAdmin(db, null)).map((u) => u.email)).not.toContain(
      "golfer@example.com",
    );
  });
});
