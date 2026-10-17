/**
 * BookOn background worker. Runs separately from the web app so slow club
 * fetches never slow the site (SPEC section 5).
 *
 *   poll [--course <slug>] [--days <n>]       one pass over enabled courses
 *   run                                       poll every POLL_INTERVAL_MINUTES
 *   record --course <slug> [--days <n>]       one pass, saving raw pages to recordings/
 */
import { parseArgs } from "node:util";
import { PoliteHttpClient } from "@bookon/adapters";
import {
  createDb,
  findCourseBySlug,
  listEnabledCourses,
  type Database,
  type PollableCourse,
} from "@bookon/db";
import { loadConfig } from "./config";
import { pollAll, type CountingHttpClient, type PollResult } from "./poll";
import { RecordingHttpClient } from "./record";

const { positionals, values } = parseArgs({
  // `pnpm poll -- --course x` passes the "--" through; drop it so the flags are read.
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  allowPositionals: true,
  options: { course: { type: "string" }, days: { type: "string" } },
});
const command = positionals[0] ?? "poll";
const days = values.days ? Number(values.days) : undefined;

const config = loadConfig();
const handle = createDb(config.databaseUrl);
await handle.migrate();

const http = new PoliteHttpClient({
  userAgent: config.userAgent,
  minIntervalMs: config.minRequestIntervalMs,
});

async function coursesToPoll(db: Database): Promise<PollableCourse[]> {
  if (!values.course) return listEnabledCourses(db);
  const course = await findCourseBySlug(db, values.course);
  if (!course) throw new Error(`No course with slug "${values.course}"`);
  // An explicit --course runs even when disabled, for testing a course before switching it on.
  return [{ ...course, enabled: true }];
}

function report(results: PollResult[]) {
  for (const r of results) {
    const detail = r.status === "error" ? r.error : `${r.teeTimes} tee times`;
    console.log(`[worker] ${r.course}: ${r.status}${detail ? ` (${detail})` : ""}`);
  }
}

async function pollOnce(client: CountingHttpClient) {
  const courses = await coursesToPoll(handle.db);
  console.log(`[worker] polling ${courses.length} course(s)`);
  report(await pollAll(handle.db, courses, client, { days }));
}

try {
  if (command === "poll") {
    await pollOnce(http);
  } else if (command === "record") {
    if (!values.course) throw new Error("record needs --course <slug>");
    const directory = new URL(`../recordings/${values.course}-${Date.now()}`, import.meta.url)
      .pathname;
    await pollOnce(new RecordingHttpClient(http, directory));
    console.log(`[worker] pages saved to ${directory}`);
  } else if (command === "run") {
    const intervalMs = config.pollIntervalMinutes * 60_000;
    console.log(`[worker] polling every ${config.pollIntervalMinutes} minutes`);
    for (;;) {
      await pollOnce(http);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } else {
    throw new Error(`Unknown command "${command}". Use poll, run or record.`);
  }
} finally {
  await handle.close();
}
