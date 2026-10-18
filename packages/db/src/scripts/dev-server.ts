/**
 * The local development database: PGlite served on 127.0.0.1:5433, so the
 * website and the worker can share it (`pnpm db:dev`).
 *
 * PGlite is a single database session. The stock pglite-server queues each
 * protocol message on its own, so two connections' messages can interleave:
 * one connection's Parse, then the other's, then the first one's Bind lands
 * on the wrong statement ("bind message supplies 1 parameters, but prepared
 * statement requires 2"). This server keeps a connection's messages together
 * until it reaches a sync point (Sync or a simple Query) and, as before, for
 * the whole of an open transaction.
 */
import { mkdirSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketHandler } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATA_DIR = fileURLToPath(new URL("../../../../.data/pglite", import.meta.url));
/** If a connection goes quiet mid-query for this long, let others go ahead. */
const STALL_MS = 10_000;

/** Message types that end a unit of work for the client: Sync, simple Query, Terminate. */
const SYNC_POINTS = new Set(["S".charCodeAt(0), "Q".charCodeAt(0), "X".charCodeAt(0)]);

interface Job {
  handlerId: number;
  message: Uint8Array;
  onData: (data: Uint8Array) => void;
  resolve: (bytes: number) => void;
  reject: (error: unknown) => void;
}

/**
 * Runs messages one at a time, and keeps serving the same connection while
 * it's partway through a query or inside a transaction.
 */
export class WholeQueryQueue {
  private queue: Job[] = [];
  private running = false;
  /** The connection that must go next, if any. */
  private owner: number | null = null;
  private stallTimer: NodeJS.Timeout | null = null;

  constructor(private readonly db: PGlite) {}

  enqueue(handlerId: number, message: Uint8Array, onData: (data: Uint8Array) => void) {
    return new Promise<number>((resolve, reject) => {
      this.queue.push({ handlerId, message, onData, resolve, reject });
      void this.run();
    });
  }

  private next(): Job | null {
    if (this.owner === null) return this.queue.shift() ?? null;
    const i = this.queue.findIndex((j) => j.handlerId === this.owner);
    return i === -1 ? null : this.queue.splice(i, 1)[0]!;
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      for (let job = this.next(); job; job = this.next()) {
        if (this.stallTimer) clearTimeout(this.stallTimer);
        this.stallTimer = null;
        let bytes = 0;
        try {
          await this.db.runExclusive(() =>
            this.db.execProtocolRawStream(job.message, {
              onRawData: (data) => {
                bytes += data.length;
                job.onData(data);
              },
            }),
          );
          job.resolve(bytes);
        } catch (error) {
          job.reject(error);
        }
        // Startup messages have no type byte (they begin with a length), and count as complete.
        const type = job.message[0]!;
        const midQuery = type !== 0 && !SYNC_POINTS.has(type);
        this.owner = midQuery || this.db.isInTransaction() ? job.handlerId : null;
      }
      if (this.owner !== null && this.queue.length > 0) {
        // Others are waiting on a connection that has gone quiet.
        const stalled = this.owner;
        this.stallTimer = setTimeout(() => {
          if (this.owner === stalled) {
            console.warn(`[db] connection #${stalled} stalled mid-query; letting others continue`);
            this.owner = null;
            void this.run();
          }
        }, STALL_MS);
      }
    } finally {
      this.running = false;
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  clearQueueForHandler(handlerId: number) {
    this.queue = this.queue.filter((j) => {
      if (j.handlerId === handlerId) j.reject(new Error("Connection closed"));
      return j.handlerId !== handlerId;
    });
  }

  /** A connection closed: undo its open transaction, and stop waiting for it. */
  async clearTransactionIfNeeded(handlerId: number) {
    if (this.owner !== handlerId) return;
    if (this.db.isInTransaction()) await this.db.exec("ROLLBACK");
    this.owner = null;
    void this.run();
  }
}

/** Serve a PGlite database on a local port. `dataDir` undefined means in memory (tests). */
export async function startLocalDatabase(options: { port: number; dataDir?: string }) {
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const db = await PGlite.create(options.dataDir);
  const queue = new WholeQueryQueue(db);
  const server = createServer(async (socket: Socket) => {
    const handler = new PGLiteSocketHandler({
      // Our queue has the same shape as the library's own.
      queryQueue: queue as unknown as ConstructorParameters<
        typeof PGLiteSocketHandler
      >[0]["queryQueue"],
      closeOnDetach: true,
    });
    await handler.attach(socket);
  });
  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve));
  return {
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const running = await startLocalDatabase({ port: PORT, dataDir: DATA_DIR });
  console.log(`Local database ready on postgres://postgres@127.0.0.1:${PORT}/postgres`);
  console.log(`Data in ${DATA_DIR}. Keep this running; Ctrl+C to stop.`);
  const stop = async () => {
    await running.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
