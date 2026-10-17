import "server-only";
import { LOCAL_DATABASE_URL, createDb, type Database } from "@bookon/db";

const globalForDb = globalThis as unknown as { bookonDb?: Database };

/** One connection pool per server process, kept across hot reloads in development. */
export function getDb(): Database {
  globalForDb.bookonDb ??= createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL).db;
  return globalForDb.bookonDb;
}
