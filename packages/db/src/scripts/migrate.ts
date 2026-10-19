import { LOCAL_DATABASE_URL, createDb } from "../client";

/**
 * Bring the database up to date. `pnpm dev` runs this with --before-dev, so the website
 * never asks for a table the local database doesn't have yet (only the worker used to
 * migrate, so pulling new code and restarting just the website broke pages).
 */
const beforeDev = process.argv.includes("--before-dev");

const handle = createDb(process.env.DATABASE_URL || LOCAL_DATABASE_URL);
try {
  await handle.migrate();
  console.log("Database up to date");
} catch (error) {
  if (!beforeDev || !refusedConnection(error)) throw error;
  // Start the website anyway; its pages say when the database can't be reached.
  console.warn(
    "Can't reach the local database, so it wasn't updated. Start it in another window with `pnpm db:dev`.",
  );
} finally {
  await handle.close();
}

/** Nothing listening at the database's address, anywhere in the error's causes. */
function refusedConnection(error: unknown): boolean {
  for (
    let e = error as { code?: string; cause?: unknown } | undefined;
    e;
    e = e.cause as typeof e
  ) {
    if (e.code === "ECONNREFUSED") return true;
  }
  return false;
}
