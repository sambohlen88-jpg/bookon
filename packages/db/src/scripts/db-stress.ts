/**
 * Hammer the local database from one process with overlapping queries of
 * different shapes and transactions. Run two at once to mimic the website
 * and worker: `pnpm --filter @bookon/db exec tsx src/scripts/db-stress.ts`.
 */
import postgres from "postgres";

const sql = postgres("postgres://postgres@127.0.0.1:5433/postgres", {
  max: Number(process.argv[2] ?? 1),
  onnotice: () => {},
});
let ok = 0;
let bad = 0;
const errors = new Set<string>();
const started = Date.now();
await Promise.all(
  Array.from({ length: 300 }, async (_, i) => {
    try {
      if (i % 10 === 0) {
        await sql.begin(async (tx) => {
          await tx`select ${i}::int as a`;
          await tx`select ${i}::int as a, ${"x"}::text as b, ${true}::bool as c`;
        });
      } else {
        const r =
          i % 3 === 0
            ? await sql`select ${i}::int as a, ${"x"}::text as b`
            : i % 3 === 1
              ? await sql`select ${i}::int as a`
              : await sql`select ${i}::int as a, ${"y"}::text as b, ${i * 2}::int as c`;
        if (r[0]!.a !== i) throw new Error(`wrong row: ${r[0]!.a} for ${i}`);
      }
      ok++;
    } catch (error) {
      bad++;
      errors.add(String((error as Error).message).slice(0, 90));
    }
  }),
);
console.log(`ok=${ok} bad=${bad} in ${Date.now() - started} ms`, [...errors].slice(0, 3));
await sql.end();
