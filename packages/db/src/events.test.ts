import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildStartSheet, perthToUtc } from "@bookon/core";
import { eq } from "drizzle-orm";
import { createDb, type DbHandle } from "./client";
import {
  EventClosed,
  EventFull,
  StartSheetProblem,
  acceptEventTerms,
  acceptedEventTerms,
  createEvent,
  createEventEntry,
  endEntry,
  entriesForEvent,
  eventTotals,
  eventsDueReminder,
  eventsJustClosed,
  joinWaitlist,
  markEntryPaid,
  moveEntryToGroup,
  placesTaken,
  publishStartSheet,
  saveStartGroups,
  setClubPaymentAccount,
  setClubPaymentsReady,
  upcomingOpenEvents,
  updateEvent,
  waitlistFor,
  type ClubEvent,
  type EventInput,
} from "./events";
import { clubById } from "./admin";
import { courses } from "./schema";
import { seed } from "./seed";

const now = perthToUtc("2026-10-23", "09:00");
const admin = { email: "owner@club.test", role: "club" as const };
let handle: DbHandle;
let clubId: string;
let courseId: string;

const base = (): EventInput => ({
  courseId,
  title: "Saturday Ambrose",
  description: "Teams of 4, BBQ after.",
  date: "2026-11-14",
  holes: 18,
  startType: "tees",
  firstStart: perthToUtc("2026-11-14", "07:00"),
  intervalMinutes: 10,
  twoTees: false,
  teamSize: 2,
  feeCents: 4500,
  memberFeeCents: 3000,
  maxPlayers: 8,
  entriesClose: perthToUtc("2026-11-12", "17:00"),
  open: true,
});

let paid = 0;
async function enter(event: ClubEvent, name: string, member = false) {
  const entry = await createEventEntry(
    handle.db,
    {
      eventId: event.id,
      players: [{ name, ...(member ? { memberNumber: "1234" } : {}) }, { name: `${name}'s mate` }],
      contactName: name,
      contactEmail: `${name.toLowerCase()}@example.com`,
      contactPhone: "+61491570110",
      bookingFeeCents: 250,
      provider: "stripe",
    },
    now,
  );
  return (await markEntryPaid(handle.db, entry.id, `pi_${++paid}`, now))!;
}

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const [course] = await handle.db.select().from(courses).where(eq(courses.slug, "collier-park"));
  courseId = course!.id;
  clubId = course!.clubId;
});
afterAll(async () => {
  await handle.close();
});

describe("club payments", () => {
  it("records the account, Stripe's answer and the owner's agreement", async () => {
    await setClubPaymentAccount(handle.db, clubId, "acct_club", now);
    await setClubPaymentsReady(handle.db, "acct_club", true, now);
    await acceptEventTerms(handle.db, clubId, "Pat Owner", admin, now);
    const club = (await clubById(handle.db, clubId))!;
    expect(club.paymentsReady).toBe(true);
    expect(acceptedEventTerms(club)).toBe(true);
  });
});

describe("entries", () => {
  it("charges members' fees per player, and holds places", async () => {
    const event = await createEvent(handle.db, clubId, base(), admin, now);
    const entry = await enter(event, "Alex", true);
    expect(entry).toMatchObject({ feesCents: 7500, bookingFeeCents: 250, playerCount: 2 });
    expect((await placesTaken(handle.db, [event.id], now)).get(event.id)).toBe(2);
    const listed = await upcomingOpenEvents(handle.db, now, { clubIds: [clubId] });
    expect(listed.find((e) => e.id === event.id)).toMatchObject({ taken: 2, left: 6 });
  });

  it("refuses entries when full or closed", async () => {
    const event = await createEvent(handle.db, clubId, { ...base(), maxPlayers: 4 }, admin, now);
    await enter(event, "Bo");
    await enter(event, "Cy");
    await expect(enter(event, "Di")).rejects.toBeInstanceOf(EventFull);
    const closed = await createEvent(
      handle.db,
      clubId,
      { ...base(), entriesClose: new Date(now.getTime() - 1000) },
      admin,
      now,
    );
    await expect(enter(closed, "Ed")).rejects.toBeInstanceOf(EventClosed);
  });

  it("frees places when an entry is withdrawn", async () => {
    const event = await createEvent(handle.db, clubId, { ...base(), maxPlayers: 2 }, admin, now);
    const entry = await enter(event, "Fi");
    await endEntry(handle.db, entry.id, { by: "golfer", refundCents: 7750 }, now);
    expect((await placesTaken(handle.db, [event.id], now)).get(event.id)).toBe(0);
    expect(await endEntry(handle.db, entry.id, { by: "golfer", refundCents: 0 }, now)).toBeNull();
  });

  it("only lets some details change once golfers have entered", async () => {
    const event = await createEvent(handle.db, clubId, base(), admin, now);
    await enter(event, "Gus");
    const changed = await updateEvent(
      handle.db,
      event,
      { ...base(), title: "Spring Ambrose", feeCents: 9900, maxPlayers: 12 },
      admin,
      now,
    );
    expect(changed).toMatchObject({ title: "Spring Ambrose", feeCents: 4500, maxPlayers: 12 });
    await expect(
      updateEvent(handle.db, changed, { ...base(), maxPlayers: 1 }, admin, now),
    ).rejects.toThrow("2 places are already taken");
  });
});

describe("start sheet", () => {
  it("places teams, moves them only where there's room, and publishes once all are placed", async () => {
    const event = await createEvent(handle.db, clubId, base(), admin, now);
    const a = await enter(event, "Hal");
    const b = await enter(event, "Ivy");
    const c = await enter(event, "Jo");
    await expect(publishStartSheet(handle.db, event, admin, now)).rejects.toBeInstanceOf(
      StartSheetProblem,
    );
    const entries = await entriesForEvent(handle.db, event.id);
    await saveStartGroups(
      handle.db,
      event.id,
      buildStartSheet(entries.map((e) => ({ id: e.id, players: e.playerCount }))),
    );
    const placed = await entriesForEvent(handle.db, event.id);
    expect(placed.map((e) => e.startGroup)).toEqual([1, 1, 2]);
    await expect(moveEntryToGroup(handle.db, event, c.id, 1)).rejects.toThrow("doesn't have room");
    const moved = await moveEntryToGroup(handle.db, event, a.id, 2);
    expect(moved.startGroup).toBe(2);
    expect(b.id).toBeTruthy();
    const published = await publishStartSheet(handle.db, event, admin, now);
    expect(published.startSheetPublishedAt).toEqual(now);
  });
});

describe("waiting list, worker and totals", () => {
  it("keeps one place in the queue per email", async () => {
    const event = await createEvent(handle.db, clubId, base(), admin, now);
    const add = (players: number) =>
      joinWaitlist(
        handle.db,
        { eventId: event.id, name: "Kim", email: "KIM@example.com", players },
        now,
      );
    await add(2);
    await add(1);
    expect((await waitlistFor(handle.db, event.id)).map((w) => [w.email, w.players])).toEqual([
      ["kim@example.com", 1],
    ]);
  });

  it("finds events that have closed, and ones due a reminder", async () => {
    const later = perthToUtc("2026-11-13", "05:00");
    expect((await eventsJustClosed(handle.db, later)).length).toBeGreaterThan(0);
    expect((await eventsDueReminder(handle.db, later)).length).toBeGreaterThan(0);
    expect(await eventsDueReminder(handle.db, now)).toEqual([]);
  });

  it("totals what was paid, less refunds", async () => {
    const totals = await eventTotals(
      handle.db,
      new Date(now.getTime() - 1000),
      new Date(now.getTime() + 1000),
    );
    // 8 entries paid, of pairs; Fi's was refunded.
    expect(totals.entries).toBe(8);
    expect(totals.players).toBe(16);
    expect(totals.feeCents).toBe(7 * 250);
  });
});
