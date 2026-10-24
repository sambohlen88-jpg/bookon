import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DbHandle } from "./client";
import {
  MatchplayProblem,
  addClubEntry,
  clubSetResult,
  compById,
  confirmResult,
  createComp,
  createOnlineEntry,
  disputeResult,
  finaliseReported,
  makeDraw,
  matchesForComp,
  publishDraw,
  reportResult,
  setSeeds,
  swapInDraw,
  type MatchplayComp,
  type MatchplayEntry,
  type MatchplayMatch,
} from "./matchplay";
import { courses } from "./schema";
import { seed } from "./seed";

const now = new Date("2026-10-24T02:00:00Z");
const actor = { email: "pat@club.test", role: "club" as const };
const same = <T>(items: T[]) => items;
let handle: DbHandle;
let clubId: string;
let courseId: string;

async function comp(maxEntries = 16): Promise<MatchplayComp> {
  return createComp(
    handle.db,
    clubId,
    {
      courseId,
      title: "Club Matchplay Championship",
      description: null,
      teamSize: 1,
      onlineEntry: true,
      feeCents: 0,
      maxEntries,
      entriesClose: null,
      open: true,
    },
    actor,
    now,
  );
}

async function field(c: MatchplayComp, names: string[]): Promise<MatchplayEntry[]> {
  const out = [];
  for (const name of names)
    out.push(
      await addClubEntry(
        handle.db,
        (await compById(handle.db, c.id))!,
        {
          players: [{ name }],
          contactEmail: `${name.toLowerCase()}@example.com`,
          contactPhone: null,
        },
        actor,
        new Date(now.getTime() + out.length * 1000),
      ),
    );
  return out;
}

const at = (ms: MatchplayMatch[], round: number, slot: number) =>
  ms.find((m) => m.round === round && m.slot === slot)!;

beforeAll(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const [course] = await handle.db.select().from(courses).where(eq(courses.slug, "point-walter"));
  courseId = course!.id;
  clubId = course!.clubId;
});
afterAll(async () => {
  await handle.close();
});

describe("entries", () => {
  it("lets golfers enter free online until the field is full", async () => {
    const c = await comp(1);
    const entry = await createOnlineEntry(
      handle.db,
      {
        compId: c.id,
        players: [{ name: "Alex" }],
        contactName: "Alex",
        contactEmail: "Alex@Example.com",
        contactPhone: "+61491570110",
        feesCents: 0,
        bookingFeeCents: 250,
        provider: null,
      },
      now,
    );
    expect(entry).toMatchObject({
      status: "entered",
      bookingFeeCents: 0,
      contactEmail: "alex@example.com",
    });
    await expect(field(c, ["Bo"])).rejects.toThrow("The field is full.");
  });
});

describe("the draw", () => {
  it("seeds the field, gives byes to the top seeds and sends them through", async () => {
    const c = await comp();
    const [a, b, , , e] = await field(c, ["Ann", "Ben", "Cal", "Dee", "Eve"]);
    await setSeeds(
      handle.db,
      c,
      new Map([
        [e!.id, 1],
        [b!.id, 2],
      ]),
    );
    const drawn = await makeDraw(handle.db, c, same, now);
    expect(drawn).toMatchObject({ status: "drawn", drawSize: 8 });
    expect(drawn.rounds).toHaveLength(3);
    const ms = await matchesForComp(handle.db, c.id);
    // Seed 1 (Eve) has a bye, so she's already in the second round.
    expect(at(ms, 1, 0)).toMatchObject({
      entryA: e!.id,
      entryB: null,
      status: "done",
      score: "Bye",
    });
    expect(at(ms, 2, 0).entryA).toBe(e!.id);
    // Ann (third in) is on the other seed-1 side; Ben (seed 2) has a bye too.
    expect(at(ms, 1, 2)).toMatchObject({ entryA: b!.id, status: "done" });
    expect(ms.filter((m) => m.round === 1 && m.status === "to-play")).toHaveLength(1);
    expect(a).toBeTruthy();
  });

  it("swaps two entries before publishing", async () => {
    const c = await comp();
    const [a, b, cc, d] = await field(c, ["Fay", "Gil", "Hal", "Ivy"]);
    await makeDraw(handle.db, c, same, now);
    const before = (await matchesForComp(handle.db, c.id)).filter((m) => m.round === 1);
    expect(before.map((m) => [m.entryA, m.entryB])).toEqual([
      [a!.id, d!.id],
      [b!.id, cc!.id],
    ]);
    await swapInDraw(handle.db, (await compById(handle.db, c.id))!, d!.id, b!.id, now);
    const after = (await matchesForComp(handle.db, c.id)).filter((m) => m.round === 1);
    expect(after.map((m) => [m.entryA, m.entryB])).toEqual([
      [a!.id, b!.id],
      [d!.id, cc!.id],
    ]);
  });
});

describe("results", () => {
  it("reports, disputes, confirms and goes all the way to a champion", async () => {
    const c = await comp();
    const [a, b, cc, d] = await field(c, ["Jo", "Kai", "Lee", "Mo"]);
    await makeDraw(handle.db, c, same, now);
    await publishDraw(handle.db, (await compById(handle.db, c.id))!, actor, now);
    let ms = await matchesForComp(handle.db, c.id);
    // Jo v Mo: Jo reports a win, Mo confirms.
    const first = await reportResult(handle.db, at(ms, 1, 0), a!.id, a!.id, "3&2", now);
    expect(first).toMatchObject({ status: "reported", score: "3&2" });
    await expect(confirmResult(handle.db, first, a!.id, now)).rejects.toBeInstanceOf(
      MatchplayProblem,
    );
    const confirmed = await confirmResult(handle.db, first, d!.id, now);
    expect(confirmed.advanced.ready).toBeNull();
    // Kai v Lee: Lee reports a win, Kai disputes, the club decides for Kai.
    const second = await reportResult(handle.db, at(ms, 1, 1), cc!.id, cc!.id, "1 up", now);
    const disputed = await disputeResult(handle.db, second, b!.id, "We didn't finish", now);
    expect(disputed.status).toBe("disputed");
    const decided = await clubSetResult(handle.db, disputed, b!.id, "2&1", now);
    expect(decided.advanced.ready).toMatchObject({
      entryA: a!.id,
      entryB: b!.id,
      status: "to-play",
    });
    // The final: Kai reports, nobody disputes, and it stands after 48 hours.
    ms = await matchesForComp(handle.db, c.id);
    await reportResult(handle.db, at(ms, 2, 0), b!.id, b!.id, "19th", now);
    expect(await finaliseReported(handle.db, new Date(now.getTime() + 47 * 3_600_000))).toEqual([]);
    const final = await finaliseReported(handle.db, new Date(now.getTime() + 49 * 3_600_000));
    expect(final[0]!.advanced.champion).toBe(b!.id);
    expect(await compById(handle.db, c.id)).toMatchObject({
      status: "finished",
      winnerEntryId: b!.id,
    });
  });

  it("lets the club change a result only until the next match is decided", async () => {
    const c = await comp();
    const [a, b, cc, d] = await field(c, ["Ned", "Oli", "Pam", "Quin"]);
    await makeDraw(handle.db, c, same, now);
    await publishDraw(handle.db, (await compById(handle.db, c.id))!, actor, now);
    let ms = await matchesForComp(handle.db, c.id);
    const one = await clubSetResult(handle.db, at(ms, 1, 0), a!.id, "Walkover", now);
    // Changed its mind: Quin won. The final's side is replaced.
    const changed = await clubSetResult(handle.db, one.match, d!.id, "4&3", now);
    ms = await matchesForComp(handle.db, c.id);
    expect(at(ms, 2, 0).entryA).toBe(d!.id);
    await clubSetResult(handle.db, at(ms, 1, 1), b!.id, "1 up", now);
    ms = await matchesForComp(handle.db, c.id);
    await clubSetResult(handle.db, at(ms, 2, 0), b!.id, "2 up", now);
    await expect(clubSetResult(handle.db, changed.match, a!.id, "1 up", now)).rejects.toThrow(
      "already has a result",
    );
    expect(cc).toBeTruthy();
  });
});
