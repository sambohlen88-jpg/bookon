import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addClubMember,
  addPhotoForClub,
  approveClubApplication,
  cannotSwitchOn,
  clubById,
  clubRole,
  clubsForEmail,
  coursesForClub,
  decideChangeRequest,
  listChangeLog,
  listChangeRequests,
  listClubMembers,
  listClubRates,
  listCoursesForAdmin,
  listPendingPhotos,
  listPhotosForClub,
  removeClubMember,
  replaceClubRates,
  requestChange,
  setCourseEnabled,
  updateClubProfile,
  updateCourse,
  type Actor,
} from "./admin";
import { createDb, type DbHandle } from "./client";
import {
  CONSENTS,
  addClubPhoto,
  clubApplicationById,
  replaceApplicationRates,
  saveApplicationDetails,
  saveConsents,
  startClubApplication,
  submitClubApplication,
  type ConsentKey,
} from "./clubs";
import {
  findCourseBySlug,
  finishFetchRun,
  recordDayFailures,
  saveDayAvailability,
  startFetchRun,
} from "./queries";
import { clubApplications, clubs } from "./schema";
import { seed } from "./seed";

const now = new Date("2026-10-18T02:00:00Z");
const admin: Actor = { email: "owner@bookon.com.au", role: "admin" };
let handle: DbHandle;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.delete(clubApplications);
});

/** A complete listing, sent to BookOn. */
async function sentListing(name = "Lakeside Golf Club") {
  const db = handle.db;
  const started = await startClubApplication(
    db,
    { clubName: name, contactName: "Jo", contactEmail: "Jo@Lakeside.example", suburb: "Como" },
    now,
  );
  if ("error" in started) throw new Error("limit");
  let app = started.application;
  await saveApplicationDetails(
    db,
    app,
    {
      ...((app.details as object) ?? {}),
      club: { name, suburb: "Como", state: "WA", website: "https://lakeside.example/" },
      courses: [
        { name: `${name} Main`, holes: 18 },
        { name: `${name} Par 3`, holes: 9 },
      ],
      teeTimes: {
        bookingSystem: "miclub",
        bookingUrl: "https://lakeside.miclub.com.au/cal",
        windowDays: 14,
      },
    },
    now,
  );
  app = (await clubApplicationById(db, app.id))!;
  await replaceApplicationRates(
    db,
    app,
    [
      {
        category: "green_fee",
        name: "18 holes",
        holes: 18,
        days: "any",
        player: "adult",
        priceCents: 4500,
        unit: "per_player",
        gstIncluded: true,
      },
    ],
    now,
  );
  await addClubPhoto(
    db,
    app,
    {
      contentType: "image/webp",
      width: 1,
      height: 1,
      data: Buffer.from("x"),
      rightsConfirmedBy: "Jo",
    },
    now,
  );
  const required = (Object.keys(CONSENTS) as ConsentKey[]).filter((k) => CONSENTS[k].required);
  await saveConsents(db, app, { accepted: required, by: "Jo", paymentsInterest: "maybe" }, now);
  app = (await clubApplicationById(db, app.id))!;
  expect(await submitClubApplication(db, app, now)).toEqual({ ok: true });
  return (await clubApplicationById(db, app.id))!;
}

describe("approving a listing", () => {
  it("creates the club, its courses switched off, prices, photos and an owner login", async () => {
    const app = await sentListing();
    const result = await approveClubApplication(handle.db, app, admin, "Welcome!", now);
    if ("error" in result) throw new Error(result.error);

    const club = (await clubById(handle.db, result.clubId))!;
    expect(club).toMatchObject({ name: "Lakeside Golf Club", slug: "lakeside-golf-club" });
    const courses = await coursesForClub(handle.db, club.id);
    expect(
      courses.map((c) => [c.name, c.holes, c.platform, c.enabled, c.bookingWindowDays]),
    ).toEqual([
      ["Lakeside Golf Club Main", 18, "miclub", false, 14],
      ["Lakeside Golf Club Par 3", 9, "miclub", false, 14],
    ]);
    expect(courses[0]!.bookingUrl).toBe("https://lakeside.miclub.com.au/cal");
    expect((await listClubRates(handle.db, club.id)).map((r) => r.priceCents)).toEqual([4500]);
    expect(await listPhotosForClub(handle.db, club.id)).toHaveLength(1);
    expect(await clubRole(handle.db, club.id, "jo@lakeside.example")).toBe("owner");
    expect((await clubApplicationById(handle.db, app.id))!).toMatchObject({
      status: "approved",
      clubId: club.id,
      reviewNotes: "Welcome!",
    });
    // Approving twice does nothing.
    expect(
      await approveClubApplication(
        handle.db,
        (await clubApplicationById(handle.db, app.id))!,
        admin,
        null,
        now,
      ),
    ).toEqual({ error: "not-submitted" });

    // A second club with the same name gets its own web addresses.
    const again = await approveClubApplication(handle.db, await sentListing(), admin, null, now);
    if ("error" in again) throw new Error(again.error);
    expect((await clubById(handle.db, again.clubId))!.slug).toBe("lakeside-golf-club-2");
  });
});

describe("club logins", () => {
  it("are by email, and a club always keeps an owner", async () => {
    const result = await approveClubApplication(
      handle.db,
      await sentListing("Members Club"),
      admin,
      null,
      now,
    );
    if ("error" in result) throw new Error(result.error);
    const clubId = result.clubId;
    await addClubMember(handle.db, clubId, "Pat@Club.example", "staff", admin, now);
    expect((await listClubMembers(handle.db, clubId)).map((m) => [m.email, m.role])).toEqual([
      ["jo@lakeside.example", "owner"],
      ["pat@club.example", "staff"],
    ]);
    expect((await clubsForEmail(handle.db, "PAT@club.example")).map((c) => c.name)).toContain(
      "Members Club",
    );
    expect(await removeClubMember(handle.db, clubId, "jo@lakeside.example", admin, now)).toEqual({
      error: "last-owner",
    });
    await addClubMember(handle.db, clubId, "pat@club.example", "owner", admin, now);
    expect(await removeClubMember(handle.db, clubId, "jo@lakeside.example", admin, now)).toEqual({
      ok: true,
    });
    expect(await clubRole(handle.db, clubId, "jo@lakeside.example")).toBeNull();
  });

  it("edit details and prices, with every change logged", async () => {
    const result = await approveClubApplication(
      handle.db,
      await sentListing("Logged Club"),
      admin,
      null,
      now,
    );
    if ("error" in result) throw new Error(result.error);
    const club = (await clubById(handle.db, result.clubId))!;
    const clubActor: Actor = { email: "jo@lakeside.example", role: "club" };
    await updateClubProfile(
      handle.db,
      club,
      { extras: { description: "New words" } },
      clubActor,
      now,
    );
    await replaceClubRates(handle.db, club.id, [], clubActor, now);
    expect(
      ((await clubById(handle.db, club.id))!.profile as { extras: { description: string } }).extras
        .description,
    ).toBe("New words");
    expect(await listClubRates(handle.db, club.id)).toEqual([]);
    const log = await listChangeLog(handle.db, { clubId: club.id });
    expect(log.map((l) => [l.actor, l.action])).toEqual([
      ["jo@lakeside.example", "Updated price list"],
      ["jo@lakeside.example", "Updated club details"],
      ["owner@bookon.com.au", "Approved club listing"],
    ]);
  });

  it("ask for booking page changes, which only apply once approved", async () => {
    const result = await approveClubApplication(
      handle.db,
      await sentListing("Request Club"),
      admin,
      null,
      now,
    );
    if ("error" in result) throw new Error(result.error);
    const [course] = await coursesForClub(handle.db, result.clubId);
    const request = {
      clubId: result.clubId,
      courseId: course!.id,
      kind: "booking_url" as const,
      value: "https://new.example/book",
      requestedBy: "jo@lakeside.example",
    };
    await requestChange(handle.db, request, now);
    await requestChange(handle.db, { ...request, value: "https://newer.example/book" }, now);
    const pending = await listChangeRequests(handle.db, {
      status: "pending",
      clubId: result.clubId,
    });
    expect(pending.map((p) => p.value)).toEqual(["https://newer.example/book"]);
    expect((await coursesForClub(handle.db, result.clubId))[0]!.bookingUrl).not.toBe(
      "https://newer.example/book",
    );
    await decideChangeRequest(handle.db, pending[0]!.id, true, admin, now);
    expect((await coursesForClub(handle.db, result.clubId))[0]!.bookingUrl).toBe(
      "https://newer.example/book",
    );
  });

  it("can add photos, which wait for approval", async () => {
    const result = await approveClubApplication(
      handle.db,
      await sentListing("Photo Club"),
      admin,
      null,
      now,
    );
    if ("error" in result) throw new Error(result.error);
    await addPhotoForClub(
      handle.db,
      result.clubId,
      {
        contentType: "image/webp",
        width: 1,
        height: 1,
        data: Buffer.from("y"),
        rightsConfirmedBy: "Jo",
      },
      { email: "jo@lakeside.example", role: "club" },
      now,
    );
    const pending = await listPendingPhotos(handle.db);
    expect(pending.filter((p) => p.clubName === "Photo Club")).toHaveLength(2);
  });
});

describe("courses in admin", () => {
  it("only switch on when BookOn can read their booking page", async () => {
    const result = await approveClubApplication(
      handle.db,
      await sentListing("Switch Club"),
      admin,
      null,
      now,
    );
    if ("error" in result) throw new Error(result.error);
    const [course] = await coursesForClub(handle.db, result.clubId);
    expect(cannotSwitchOn(course!)).toMatch(/booking system settings/);
    expect(await setCourseEnabled(handle.db, course!, true, admin, now)).toMatchObject({
      error: expect.any(String),
    });
    await updateCourse(
      handle.db,
      course!,
      {
        name: course!.name,
        suburb: course!.suburb,
        area: "south",
        latitude: -32.01,
        longitude: 115.87,
        holes: course!.holes,
        websiteUrl: course!.websiteUrl,
        bookingUrl: course!.bookingUrl,
        bookingWindowDays: course!.bookingWindowDays,
        typicalGreenFeeCents: 4500,
        notes: null,
        platform: "miclub",
        platformConfig: { baseUrl: "https://lakeside.miclub.com.au", bookingResourceId: "1" },
      },
      admin,
      now,
    );
    const updated = (await coursesForClub(handle.db, result.clubId))[0]!;
    // Settings alone aren't enough: the worker must have read the page once.
    expect(await setCourseEnabled(handle.db, updated, true, admin, now)).toMatchObject({
      error: expect.stringContaining("Test the course with the worker"),
    });
    await saveDayAvailability(handle.db, updated.id, "2026-10-18", [], now);
    expect(cannotSwitchOn(updated)).toBeNull();
    expect(await setCourseEnabled(handle.db, updated, true, admin, now)).toEqual({ ok: true });
    const log = await listChangeLog(handle.db, { clubId: result.clubId, limit: 2 });
    expect(log[0]!.action).toBe("Switched course on");
    expect(log[1]!.details).toMatchObject({
      typicalGreenFeeCents: { from: null, to: 4500 },
      area: { from: null, to: "south" },
    });
    expect(cannotSwitchOn({ ...updated, platform: "chronogolf" })).toMatch(/Chronogolf/);
  });

  it("show how each course's checks are going", async () => {
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    const run = await startFetchRun(handle.db, collier.id, "2026-10-18", "2026-10-18", now);
    await recordDayFailures(
      handle.db,
      collier.id,
      ["2026-10-18"],
      "CaptchaRequiredError: asks for a CAPTCHA",
      now,
    );
    await finishFetchRun(
      handle.db,
      run,
      {
        status: "error",
        requestCount: 1,
        teeTimeCount: 0,
        error: "CaptchaRequiredError: asks for a CAPTCHA",
      },
      now,
    );
    const health = (await listCoursesForAdmin(handle.db, now)).find(
      (c) => c.slug === "collier-park",
    )!.health;
    expect(health).toMatchObject({
      lastRunStatus: "error",
      problem: "blocked",
      failures24h: 1,
      runs24h: 1,
    });
  });
});

it("keeps clubs from the seed data", async () => {
  expect((await handle.db.select().from(clubs)).length).toBeGreaterThan(20);
});
