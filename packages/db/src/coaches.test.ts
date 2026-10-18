import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CoachProfile } from "@bookon/core";
import { createDb, type DbHandle } from "./client";
import {
  addCoachPhoto,
  approveCoach,
  coachById,
  coachContactCounts,
  coachCounts,
  coachForEmail,
  declineCoach,
  isLocalDatabaseUrl,
  listLiveCoaches,
  liveCoachBySlug,
  logCoachContact,
  saveCoachDraft,
  seedSampleCoaches,
  setCoachHidden,
  setCoachPhotoStatus,
  setSocialLinks,
  socialLinks,
  submitCoach,
} from "./coaches";
import { seed } from "./seed";

const now = new Date("2026-10-18T02:00:00Z");
const admin = { email: "admin@bookon.test", role: "admin" as const };

let handle: DbHandle;
beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
});
afterAll(async () => {
  await handle.close();
});

function profile(overrides: Partial<CoachProfile> = {}): CoachProfile {
  return {
    name: "Sam Coach",
    headline: "All-round",
    bio: "Lessons for everyone.",
    specialities: ["all-round"],
    rates: [{ name: "Private lesson", minutes: 60, priceCents: 10000, people: "1" }],
    hours: [{ day: 6, from: "07:00", to: "12:00" }],
    away: [],
    places: [{ courseSlug: "collier-park", name: "Collier Park Golf Course", suburb: "Como" }],
    suburb: "Como",
    area: "south",
    contact: { whatsapp: "+61491570159" },
    ...overrides,
  };
}

describe("coach listings", () => {
  it("start as a draft, need consent to send, and go live once approved", async () => {
    const db = handle.db;
    const draft = await saveCoachDraft(db, "Sam@Coach.test", profile(), now);
    expect(draft).toMatchObject({ email: "sam@coach.test", slug: "sam-coach", status: "new" });
    expect(await submitCoach(db, draft.id, now)).toEqual({ error: "no-consent" });

    await saveCoachDraft(db, "sam@coach.test", profile(), now, { by: "Sam Coach" });
    expect(await submitCoach(db, draft.id, now)).toEqual({ ok: true });
    expect((await coachCounts(db)).waiting).toBe(1);
    // Not on the site until approved.
    expect(await liveCoachBySlug(db, "sam-coach")).toBeNull();

    await approveCoach(db, (await coachById(db, draft.id))!, admin, null, now);
    const live = await liveCoachBySlug(db, "sam-coach");
    expect(live?.profile.name).toBe("Sam Coach");
    // Found on the map from their BookOn course.
    expect(live?.latitude).toBeCloseTo(-32.001, 2);
    expect((await coachCounts(db)).waiting).toBe(0);
  });

  it("keep showing the live profile while changes wait for review", async () => {
    const db = handle.db;
    const coach = (await coachForEmail(db, "sam@coach.test"))!;
    await saveCoachDraft(db, coach.email, profile({ headline: "Short game" }), now);
    await submitCoach(db, coach.id, now);
    expect((await liveCoachBySlug(db, "sam-coach"))?.profile.headline).toBe("All-round");

    await declineCoach(db, (await coachById(db, coach.id))!, admin, "Add your PGA number", now);
    const declined = (await coachById(db, coach.id))!;
    // Still live, with the draft kept to fix and the note to read.
    expect(declined).toMatchObject({ status: "live", submittedAt: null });
    expect(declined.draft?.headline).toBe("Short game");
    expect(declined.reviewNote).toBe("Add your PGA number");
  });

  it("can be hidden by an admin", async () => {
    const db = handle.db;
    const coach = (await coachForEmail(db, "sam@coach.test"))!;
    await setCoachHidden(db, coach, true, admin, now);
    expect(await liveCoachBySlug(db, "sam-coach")).toBeNull();
    await setCoachHidden(db, (await coachById(db, coach.id))!, false, admin, now);
    expect(await liveCoachBySlug(db, "sam-coach")).not.toBeNull();
  });

  it("show a photo once approved", async () => {
    const db = handle.db;
    const coach = (await coachForEmail(db, "sam@coach.test"))!;
    const photo = { data: Buffer.from("x"), width: 10, height: 10, contentType: "image/webp" };
    const added = await addCoachPhoto(db, coach.id, photo, "Sam Coach", now);
    expect("id" in added).toBe(true);
    expect((await liveCoachBySlug(db, "sam-coach"))?.photoId).toBeNull();
    await setCoachPhotoStatus(db, (added as { id: string }).id, "approved", admin, now);
    expect((await liveCoachBySlug(db, "sam-coach"))?.photoId).toBe((added as { id: string }).id);
  });

  it("count contact taps by method", async () => {
    const db = handle.db;
    const coach = (await coachForEmail(db, "sam@coach.test"))!;
    await logCoachContact(db, coach.id, "whatsapp", "s1", now);
    await logCoachContact(db, coach.id, "whatsapp", "s2", now);
    await logCoachContact(db, coach.id, "email", null, now);
    expect(await coachContactCounts(db, coach.id, new Date(now.getTime() - 1000))).toEqual({
      whatsapp: 2,
      email: 1,
      phone: 0,
      website: 0,
    });
  });
});

describe("sample coaches", () => {
  it("are added once, marked as samples, with one away next week", async () => {
    const db = handle.db;
    expect(await seedSampleCoaches(db, now)).toBe(3);
    expect(await seedSampleCoaches(db, now)).toBe(0);
    const samples = (await listLiveCoaches(db)).filter((c) => c.sample);
    expect(samples.map((c) => c.profile.name)).toEqual([
      "Daniel Reyes",
      "Grace Okafor",
      "Mia Hartley",
    ]);
    // Sunday 18 October: next week starts Monday the 19th.
    expect(samples[0]!.profile.away).toEqual([{ from: "2026-10-19", to: "2026-10-21" }]);
    // Nobody real can be reached: example.com and Australia's numbers kept for fiction.
    for (const c of samples) {
      expect(c.profile.contact.email ?? "x@example.com").toMatch(/@example\.com$/);
      expect(c.profile.contact.whatsapp).toMatch(/^\+6149157015\d$/);
    }
  });

  it("are only for local databases", () => {
    expect(isLocalDatabaseUrl("pglite:memory")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://postgres@127.0.0.1:5433/postgres")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@db.example.supabase.co:5432/postgres")).toBe(false);
  });
});

describe("social links", () => {
  it("are saved by admins", async () => {
    expect(await socialLinks(handle.db)).toEqual({});
    await setSocialLinks(handle.db, { instagram: "https://instagram.com/bookon" }, admin, now);
    expect(await socialLinks(handle.db)).toEqual({ instagram: "https://instagram.com/bookon" });
  });
});
