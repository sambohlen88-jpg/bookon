/**
 * BookOn background worker. Runs separately from the web app so slow club
 * fetches never slow the site (SPEC section 5).
 *
 *   poll [--course <slug>] [--days <n>]       one pass over enabled courses
 *   run                                       poll every POLL_INTERVAL_MINUTES
 *   record --course <slug> [--days <n>]       one pass, saving raw pages to recordings/
 *   alerts                                    email alert matches from data already stored
 *   weather                                   refresh course forecasts from MET Norway
 *
 * poll and run email alert matches after each pass. run also keeps the weather fresh.
 */
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PoliteHttpClient } from "@bookon/adapters";
import {
  createDb,
  findCourseBySlug,
  listEnabledCourses,
  type Database,
  type PollableCourse,
} from "@bookon/db";
import { WebPushSender, createMailer, siteUrl, vapidKeys } from "@bookon/email";
import { sendAlertNotifications } from "./alerts";
import { loadConfig } from "./config";
import type { HttpClient } from "@bookon/core";
import { pollAll, type PollResult } from "./poll";
import { RecordingHttpClient } from "./record";
import { refreshWeather } from "./weather";

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
  alsoObeyAgents: config.alsoObeyAgents,
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

async function pollOnce(client: HttpClient) {
  const courses = await coursesToPoll(handle.db);
  console.log(`[worker] polling ${courses.length} course(s)`);
  report(await pollAll(handle.db, courses, client, { days }));
}

/** Never stops the worker: a problem here is logged and tried again next pass. */
async function alertsOnce() {
  try {
    const keys = await vapidKeys(handle.db);
    if (!keys) console.error("[alerts] VAPID keys are not set, so push notifications are off");
    const result = await sendAlertNotifications(
      handle.db,
      {
        mailer: createMailer(handle.db),
        push: keys ? new WebPushSender(keys, `mailto:${config.contactEmail}`) : null,
      },
      { now: new Date(), site: siteUrl() },
    );
    console.log(
      `[alerts] ${result.sent} sent (${result.pushed} by push, ${result.emailed} by email), ${result.failed} failed, ${result.ended} ended`,
    );
  } catch (error) {
    console.error("[alerts] could not check alerts", error);
  }
}

/** Never stops the worker either. Forecasts only need courses that have a location. */
async function weatherOnce() {
  try {
    const result = await refreshWeather(handle.db, await listEnabledCourses(handle.db), {
      userAgent: config.userAgent,
    });
    console.log(
      `[weather] ${result.fetched} updated, ${result.unchanged} unchanged, ${result.skipped} not due or no location, ${result.failed} failed`,
    );
  } catch (error) {
    console.error("[weather] could not refresh forecasts", error);
  }
}

try {
  if (command === "poll") {
    await pollOnce(http);
    await alertsOnce();
  } else if (command === "alerts") {
    await alertsOnce();
  } else if (command === "weather") {
    await weatherOnce();
  } else if (command === "record") {
    if (!values.course) throw new Error("record needs --course <slug>");
    const directory = fileURLToPath(
      new URL(`../recordings/${values.course}-${Date.now()}`, import.meta.url),
    );
    await pollOnce(new RecordingHttpClient(http, directory));
    console.log(`[worker] pages saved to ${directory}`);
  } else if (command === "run") {
    const intervalMs = config.pollIntervalMinutes * 60_000;
    console.log(`[worker] polling every ${config.pollIntervalMinutes} minutes`);
    for (;;) {
      await pollOnce(http);
      await alertsOnce();
      await weatherOnce();
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } else {
    throw new Error(`Unknown command "${command}". Use poll, run, record, alerts or weather.`);
  }
} finally {
  await handle.close();
}
