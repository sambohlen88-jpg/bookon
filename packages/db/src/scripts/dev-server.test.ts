import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
