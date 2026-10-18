/** `pnpm db:dev`: the local database the website and worker share. Ctrl+C to stop. */
import { fileURLToPath } from "node:url";
import { startLocalDatabase } from "./dev-server";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATA_DIR = fileURLToPath(new URL("../../../../.data/pglite", import.meta.url));

const running = await startLocalDatabase({ port: PORT, dataDir: DATA_DIR });
console.log(`Local database ready on postgres://postgres@127.0.0.1:${PORT}/postgres`);
console.log(`Data in ${DATA_DIR}. Keep this running; Ctrl+C to stop.`);
const stop = async () => {
  await running.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
