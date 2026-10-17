import { mkdirSync } from "node:fs";
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

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Connect to the database named by `url`:
 * - `postgres://...` for Supabase, Neon or any Postgres.
 * - `pglite:memory` for an in-memory database (tests).
 * - `pglite:<dir>` for a local file database (development, no server needed).
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const sql = postgres(url, { max: 5 });
    const db = drizzlePostgres(sql, { schema });
    return {
      db: db as unknown as Database,
      migrate: () => migratePostgres(db, { migrationsFolder }),
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
      migrate: () => migratePglite(db, { migrationsFolder }),
      close: () => client.close(),
    };
  }

  throw new Error("DATABASE_URL must start with postgres://, postgresql:// or pglite:");
}

/** The default for local development when DATABASE_URL is not set. */
export const LOCAL_DATABASE_URL = `pglite:${fileURLToPath(new URL("../../../.data/pglite", import.meta.url))}`;
