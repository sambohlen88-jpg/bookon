/**
 * BookOn background worker. Runs separately from the web app so slow club
 * fetches never slow the site (SPEC section 5).
 *
 *   poll [--course <slug>] [--days <n>]       one pass over enabled courses
 *   run                                       poll every POLL_INTERVAL_MINUTES
 *   record --course <slug> [--days <n>]       one pass, saving raw pages to recordings/
 *   alerts                                    email alert matches from data already stored
 *   weather                                   refresh course forecasts from MET Norway
 *   lessons                                   close unpaid lesson checkouts, lapse unanswered requests
 *   calendars                                 re-read coaches' own calendar links for busy times
 *
 * poll and run email alert matches, tidy lesson bookings and re-read coaches' calendars after each pass. run also keeps
 * the weather fresh.
 */
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PoliteHttpClient } from "@bookon/adapters";
import {
  LOCAL_DATABASE_URL,
  createDb,
  findCourseBySlug,
  listEnabledCourses,
  isLocalDatabaseUrl,
  seedIfEmpty,
  seedSampleCoaches,
  type Database,
  type PollableCourse,
} from "@bookon/db";
import { WebPushSender, createMailer, siteUrl, vapidKeys } from "@bookon/email";
import { paymentProvider, tidyEvents, tidyGroups, tidyLessons } from "@bookon/payments";
import { sendAlertNotifications } from "./alerts";
import { refreshCoachCalendars } from "./calendars";
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
try {
  await handle.migrate();
} catch (error) {
  if (!refusedConnection(error)) throw error;
  console.error(
    config.databaseUrl === LOCAL_DATABASE_URL
      ? "[worker] Can't reach the local database. Start it in another window with `pnpm db:dev`, leave it running, then start the worker again."
      : "[worker] Can't reach the database in DATABASE_URL. Check it's running and the address is right.",
  );
  process.exit(1);
}
// A new database (say, after deleting the local one) gets the courses without `pnpm db:seed`.
if (await seedIfEmpty(handle.db)) console.log("[worker] New database: added the courses.");
// Made-up coaches to show the Coaches pages, on local databases only (never a hosted one).
if (isLocalDatabaseUrl(config.databaseUrl) && (await seedSampleCoaches(handle.db)) > 0)
  console.log("[worker] Added 3 sample coaches (local database only).");

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

/**
 * Lesson bookings (Milestone 15): release holds the coach didn't answer in time,
 * and free times left at checkout. Group sessions (Milestone 19): call off
 * sessions short of their minimum 24 hours before, and refund anyone on a
 * cancelled session. Club events (Milestone 21): tell clubs when entries
 * close, remind entrants the day before, and refund anyone on a cancelled
 * event. Never stops the worker either.
 */
async function lessonsOnce() {
  const payments = paymentProvider(process.env, {
    site: siteUrl(),
    localDatabase: isLocalDatabaseUrl(config.databaseUrl),
  });
  if (!payments) return;
  try {
    const ctx = {
      db: handle.db,
      payments,
      mailer: createMailer(handle.db),
      site: siteUrl(),
      now: new Date(),
    };
    const result = await tidyLessons(ctx);
    if (result.closed || result.lapsed)
      console.log(`[lessons] ${result.closed} checkouts closed, ${result.lapsed} requests lapsed`);
    const groups = await tidyGroups(ctx);
    if (groups.closed || groups.calledOff || groups.goingAhead || groups.refunded)
      console.log(
        `[groups] ${groups.closed} checkouts closed, ${groups.calledOff} called off, ${groups.goingAhead} going ahead, ${groups.refunded} refunded`,
      );
    const events = await tidyEvents(ctx);
    if (events.closed || events.notices || events.reminders || events.refunded)
      console.log(
        `[events] ${events.closed} checkouts closed, ${events.notices} clubs told entries closed, ${events.reminders} reminders, ${events.refunded} refunded`,
      );
  } catch (error) {
    console.error("[lessons] could not tidy lesson bookings", error);
  }
}

/** Coaches' own calendars, for times they're busy (Milestone 16). Never stops the worker either. */
async function calendarsOnce() {
  try {
    const result = await refreshCoachCalendars(handle.db, {
      userAgent: config.userAgent,
      now: new Date(),
    });
    if (result.read || result.failed)
      console.log(
        `[calendars] ${result.read} read, ${result.fresh} still fresh, ${result.failed} failed`,
      );
  } catch (error) {
    console.error("[calendars] could not read coaches' calendars", error);
  }
}

/** Never stops the worker either. Forecasts only need courses that have a location. */
async function weatherOnce() {
  try {
    const result = await refreshWeather(handle.db, await listEnabledCourses(handle.db), {
      userAgent: config.userAgent,
    });
    console.log(
      `[weather] ${result.fetched} updated, ${result.unchanged} unchanged, ${result.fresh} still fresh, ${result.noLocation} with no location, ${result.failed} failed`,
    );
  } catch (error) {
    console.error("[weather] could not refresh forecasts", error);
  }
}

try {
  if (command === "poll") {
    await pollOnce(http);
    await alertsOnce();
    await lessonsOnce();
    await calendarsOnce();
  } else if (command === "alerts") {
    await alertsOnce();
  } else if (command === "lessons") {
    await lessonsOnce();
  } else if (command === "calendars") {
    await calendarsOnce();
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
      // Weather first: it's quick, so forecasts show without waiting for a full pass.
      await weatherOnce();
      await pollOnce(http);
      await alertsOnce();
      await lessonsOnce();
      await calendarsOnce();
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } else {
    throw new Error(
      `Unknown command "${command}". Use poll, run, record, alerts, lessons, calendars or weather.`,
    );
  }
} finally {
  await handle.close();
}
