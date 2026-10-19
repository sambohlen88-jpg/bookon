import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { findCourseBySlug, pruneOldSnapshots, saveDayAvailability } from "../queries";
import { unbookedSlots } from "../schema";
import { seed } from "../seed";
import { startLocalDatabase } from "./dev-server";

const port = 5600 + Math.floor(Math.random() * 300);
let server: Awaited<ReturnType<typeof startLocalDatabase>>;

beforeAll(async () => {
  server = await startLocalDatabase({ port });
}, 30_000);

afterAll(async () => {
  await server.stop();
});

/** One client, like the website or the worker, firing overlapping queries of different shapes. */
async function client(connections: number, label: string) {
  const sql = postgres(`postgres://postgres@127.0.0.1:${port}/postgres`, {
    max: connections,
    onnotice: () => {},
  });
  const results = await Promise.allSettled(
    Array.from({ length: 120 }, async (_, i) => {
      if (i % 10 === 0) {
        return sql.begin(async (tx) => {
          await tx`select ${i}::int as a`;
          const [row] = await tx`select ${i}::int as a, ${label}::text as b`;
          return row!.a === i && row!.b === label;
        });
      }
      const [row] =
        i % 2
          ? await sql`select ${i}::int as a, ${label}::text as b`
          : await sql`select ${i}::int as a`;
      return row!.a === i && (i % 2 === 0 || row!.b === label);
    }),
  );
  await sql.end();
  return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
}

describe("the local database server", () => {
  it("keeps each query together when several connections overlap", async () => {
    // The stock server failed most of these: Bind landed on another connection's Parse.
    const [website, worker, script] = await Promise.all([
      client(1, "website"),
      client(1, "worker"),
      client(3, "script"),
    ]);
    expect([website, worker, script]).toEqual([120, 120, 120]);
  }, 60_000);
});

describe("unbooked tee times through the worker's database driver", () => {
  it("records them when a day is checked again or cleared", async () => {
    // The worker talks to Postgres through postgres-js, which is stricter about values than PGlite.
    const handle = createDb(`postgres://postgres@127.0.0.1:${port}/postgres`);
    await handle.migrate();
    await seed(handle.db);
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!.id;
    const at = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+08:00`);
    const slot = (hhmm: string) => ({
      courseId: collier,
      startTime: at(hhmm),
      holes: 18,
      layout: null,
      spotsAvailable: 2,
      minPlayers: 1,
      priceCents: 4000,
      sourceUrl: "https://example.com",
      bookingUrl: null,
    });
    await saveDayAvailability(
      handle.db,
      collier,
      "2026-10-19",
      [slot("07:50"), slot("17:30")],
      at("07:20"),
    );
    await saveDayAvailability(handle.db, collier, "2026-10-19", [slot("17:30")], at("08:00"));
    await saveDayAvailability(handle.db, collier, "2026-10-19", [slot("17:30")], at("17:10"));
    await pruneOldSnapshots(handle.db, "2026-10-20", new Date("2026-10-20T06:00:00+08:00"));
    const rows = await handle.db.select().from(unbookedSlots);
    expect(rows.map((r) => r.startTime.toISOString()).sort()).toEqual([
      at("07:50").toISOString(),
      at("17:30").toISOString(),
    ]);
    await handle.close();
  }, 60_000);
});
