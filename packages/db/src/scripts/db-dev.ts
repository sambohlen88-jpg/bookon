/** `pnpm db:dev`: the local database the website and worker share. Ctrl+C to stop. */
import { fileURLToPath } from "node:url";
import { startLocalDatabase } from "./dev-server";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATA_DIR = fileURLToPath(new URL("../../../../.data/pglite", import.meta.url));

let running: Awaited<ReturnType<typeof startLocalDatabase>>;
try {
  running = await startLocalDatabase({ port: PORT, dataDir: DATA_DIR });
} catch (error) {
  // Usually a database folder left half made, e.g. stopped while it was first being set up.
  console.error(`
Couldn't open the local database in ${DATA_DIR}.
It may have been damaged, for example by stopping it while it was starting.
It only holds test data (the worker fetches it again), so delete it and start again:

  Mac:      rm -rf .data/pglite
  Windows:  Remove-Item -Recurse -Force .data\\pglite

Then run pnpm db:dev again.
`);
  console.error(error);
  process.exit(1);
}
console.log(`Local database ready on postgres://postgres@127.0.0.1:${PORT}/postgres`);
console.log(`Data in ${DATA_DIR}. Keep this running; Ctrl+C to stop.`);
const stop = async () => {
  await running.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
