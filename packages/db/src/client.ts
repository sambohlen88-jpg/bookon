import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Database;
  migrate(): Promise<void>;
  close(): Promise<void>;
}

/** Resolved only when migrating. Written this way so bundlers don't try to bundle the folder. */
function migrationsFolder(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
}

/**
 * Connect to the database named by `url`:
 * - `postgres://...` for Supabase, Neon or any Postgres.
 * - `pglite:memory` for an in-memory database (tests).
 * - `pglite:<dir>` for a file database only one process will open.
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // The local PGlite server is one database session, so queries from two connections can
    // interleave and break each other. One connection keeps them in order.
    const max = url === LOCAL_DATABASE_URL ? 1 : 5;
    // Silence NOTICEs such as "schema already exists, skipping" on every migrate.
    const sql = postgres(url, { max, onnotice: () => {} });
    const db = drizzlePostgres(sql, { schema });
    return {
      db: db as unknown as Database,
      migrate: () => migratePostgres(db, { migrationsFolder: migrationsFolder() }),
      close: () => sql.end(),
    };
  }

  if (url.startsWith("pglite:")) {
    const location = url.slice("pglite:".length);
    if (location !== "memory") mkdirSync(location, { recursive: true });
    const client = new PGlite(location === "memory" ? undefined : location);
    const db = drizzlePglite(client, { schema });
    return {
      db: db as unknown as Database,
      migrate: () => migratePglite(db, { migrationsFolder: migrationsFolder() }),
      close: () => client.close(),
    };
  }

  throw new Error("DATABASE_URL must start with postgres://, postgresql:// or pglite:");
}

/**
 * The default when DATABASE_URL is not set: the local PGlite server started by
 * `pnpm db:dev`, which lets the web app and the worker share one database.
 */
export const LOCAL_DATABASE_URL = "postgres://postgres@127.0.0.1:5433/postgres";
