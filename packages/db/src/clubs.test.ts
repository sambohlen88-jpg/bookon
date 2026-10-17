import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client";
import {
  APPLICATIONS_PER_DAY,
  CONSENTS,
  MAX_CLUB_PHOTOS,
  addClubPhoto,
  applicationByToken,
  applicationConsents,
  applicationDetails,
  applicationProblems,
  approvedCoursePhotos,
  checkRate,
  clubApplicationById,
  listApplicationRates,
  listClubPhotos,
  replaceApplicationRates,
  saveApplicationDetails,
  saveConsents,
  setClubPhotoStatus,
  startClubApplication,
  submitClubApplication,
  type ConsentKey,
  type RateInput,
} from "./clubs";
import { findCourseBySlug } from "./queries";
import { clubApplications } from "./schema";
import { seed } from "./seed";

const now = new Date("2026-10-17T23:00:00Z");
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

async function start(email = "pro@club.example") {
  const result = await startClubApplication(
    handle.db,
    { clubName: "Lakeside Golf", contactName: "Jo Smith", contactEmail: email, suburb: "Como" },
    now,
  );
  if ("error" in result) throw new Error(result.error);
  return result;
}

const greenFee: RateInput = {
  category: "green_fee",
  name: "18 holes weekday",
  holes: 18,
  days: "weekday",
  player: "adult",
  priceCents: 4200,
  unit: "per_player",
  gstIncluded: true,
};

describe("checkRate", () => {
  it("cleans a price line from the form", () => {
    expect(
      checkRate({
        category: "cart",
        name: " Cart 18 holes ",
        holes: "18",
        days: "weekend",
        player: "any",
        price: "$45.50",
        unit: "per_cart",
        timeFrom: "15:00",
        timeTo: "",
        notes: "",
      }),
    ).toMatchObject({
      name: "Cart 18 holes",
      holes: 18,
      priceCents: 4550,
      unit: "per_cart",
      timeFrom: "15:00",
      timeTo: null,
      notes: null,
      gstIncluded: true,
    });
  });

  it("explains what's wrong in plain words", () => {
    expect(checkRate({ category: "green_fee", price: "40" })).toEqual({
      problem: "Give each price a name, such as “18 holes weekday”.",
    });
    expect(checkRate({ category: "green_fee", name: "Twilight", price: "forty" })).toMatchObject({
      problem: expect.stringContaining("Enter a price in dollars"),
    });
    expect(
      checkRate({ category: "deal", name: "Midweek special", price: 30, days: "custom" }),
    ).toMatchObject({ problem: expect.stringContaining("Tick the days") });
    expect(
      checkRate({
        category: "green_fee",
        name: "Twilight",
        price: 30,
        timeFrom: "18:00",
        timeTo: "15:00",
      }),
    ).toMatchObject({ problem: expect.stringContaining("start time") });
    expect(checkRate({ category: "spa", name: "Massage", price: 30 })).toMatchObject({
      problem: expect.stringContaining("Choose what"),
    });
  });

  it("keeps custom days, and dates for seasons and deals", () => {
    expect(
      checkRate({
        category: "deal",
        name: "Tuesday 2-for-1",
        price: 60,
        days: "custom",
        daysOfWeek: [2, "2", 9],
        validFrom: "2026-11-01",
        validTo: "2027-02-28",
        unit: "per_group",
      }),
    ).toMatchObject({ daysOfWeek: [2], validFrom: "2026-11-01", validTo: "2027-02-28" });
  });
});

describe("club applications", () => {
  it("start with a private link, and limit how many one address can start", async () => {
    const { token, application } = await start();
    expect((await applicationByToken(handle.db, token))?.id).toBe(application.id);
    expect(await applicationByToken(handle.db, "not-the-token")).toBeNull();
    expect(applicationDetails(application).club).toMatchObject({
      name: "Lakeside Golf",
      suburb: "Como",
      state: "WA",
    });
    for (let i = 1; i < APPLICATIONS_PER_DAY; i++) await start();
    expect(
      await startClubApplication(
        handle.db,
        { clubName: "x", contactName: "y", contactEmail: "pro@club.example" },
        now,
      ),
    ).toEqual({ error: "limit" });
  });

  it("save sections, prices and approvals, then send when complete", async () => {
    const { application } = await start();
    let app = application;
    expect(applicationProblems(app, [])).toEqual([
      "At least one course",
      "How golfers book",
      "At least one green fee",
      "The approvals",
    ]);

    await saveApplicationDetails(
      handle.db,
      app,
      {
        courses: [{ name: "Lakeside", holes: 18, par: 72 }],
        teeTimes: { bookingSystem: "miclub", intervalMinutes: 8, windowDays: 14 },
      },
      now,
    );
    app = (await clubApplicationById(handle.db, app.id))!;
    expect(applicationDetails(app).club?.name).toBe("Lakeside Golf");
    expect(applicationDetails(app).teeTimes?.intervalMinutes).toBe(8);

    await replaceApplicationRates(
      handle.db,
      app,
      [greenFee, { ...greenFee, name: "Cart", category: "cart", unit: "per_cart" }],
      now,
    );
    await replaceApplicationRates(handle.db, app, [greenFee], now);
    expect((await listApplicationRates(handle.db, app.id)).map((r) => r.name)).toEqual([
      "18 holes weekday",
    ]);

    const required = (Object.keys(CONSENTS) as ConsentKey[]).filter((k) => CONSENTS[k].required);
    await saveConsents(
      handle.db,
      app,
      { accepted: required.slice(1), by: "Jo Smith", paymentsInterest: "maybe" },
      now,
    );
    app = (await clubApplicationById(handle.db, app.id))!;
    expect(await submitClubApplication(handle.db, app, now)).toEqual({
      problems: ["The approvals"],
    });

    await saveConsents(
      handle.db,
      app,
      {
        accepted: required,
        by: "Jo Smith",
        role: "Manager",
        paymentsInterest: "yes",
        payments: { gstRegistered: true },
      },
      now,
    );
    app = (await clubApplicationById(handle.db, app.id))!;
    expect(applicationConsents(app).read_booking_page).toMatchObject({
      accepted: true,
      by: "Jo Smith",
      role: "Manager",
      text: CONSENTS.read_booking_page.text,
    });
    expect(applicationConsents(app).news?.accepted).toBe(false);
    expect(app.paymentsInterest).toBe("yes");
    expect(applicationDetails(app).payments?.gstRegistered).toBe(true);

    expect(await submitClubApplication(handle.db, app, now)).toEqual({ ok: true });
    app = (await clubApplicationById(handle.db, app.id))!;
    expect(app.status).toBe("submitted");
    // Sent applications can't be changed through the link any more.
    expect(await saveApplicationDetails(handle.db, app, { courses: [] }, now)).toBe(false);
    expect(await replaceApplicationRates(handle.db, app, [], now)).toBe(false);
  });

  it("take a limited number of photos, shown once approved", async () => {
    const { application } = await start();
    const photo = {
      contentType: "image/webp",
      width: 10,
      height: 10,
      data: Buffer.from("x"),
      rightsConfirmedBy: "Jo Smith",
    };
    for (let i = 0; i < MAX_CLUB_PHOTOS; i++)
      await addClubPhoto(handle.db, application, photo, now);
    expect(await addClubPhoto(handle.db, application, photo, now)).toEqual({ error: "limit" });
    const [first] = await listClubPhotos(handle.db, application.id);
    expect(first).not.toHaveProperty("data");
    expect((await approvedCoursePhotos(handle.db)).size).toBe(0);

    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    await setClubPhotoStatus(handle.db, first!.id, "approved", collier.id);
    expect((await approvedCoursePhotos(handle.db)).get(collier.id)).toBe(first!.id);
  });
});
