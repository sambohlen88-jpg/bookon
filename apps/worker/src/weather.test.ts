import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  findCourseBySlug,
  forecastFor,
  seed,
  setCourseLocation,
  type DbHandle,
} from "@bookon/db";
import { refreshWeather } from "./weather";

const now = () => new Date("2026-10-18T03:00:00Z");
let handle: DbHandle;

beforeEach(async () => {
  handle = createDb("pglite:memory");
  await handle.migrate();
  await seed(handle.db);
  const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
  await setCourseLocation(handle.db, collier.id, { latitude: -32.0, longitude: 115.8712345 });
});

afterEach(async () => {
  await handle.close();
});

/** MET Norway's documented response shape, cut down to one hour. */
const body = {
  properties: {
    timeseries: [
      {
        time: "2026-10-18T04:00:00Z",
        data: {
          instant: { details: { air_temperature: 22.4, wind_speed: 4 } },
          next_1_hours: {
            summary: { symbol_code: "fair_day" },
            details: { precipitation_amount: 0 },
          },
        },
      },
    ],
  },
};

function fakeMet(responses: Response[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    return responses.shift()!;
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

describe("refreshWeather", () => {
  it("fetches courses with a location, saves the forecast, then waits until it expires", async () => {
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    // A course with no location yet is skipped.
    const unplaced = {
      ...(await findCourseBySlug(handle.db, "wembley"))!,
      latitude: null,
      longitude: null,
    };
    const met = fakeMet([
      new Response(JSON.stringify(body), {
        headers: {
          expires: "Sun, 18 Oct 2026 03:30:00 GMT",
          "last-modified": "Sun, 18 Oct 2026 02:55:00 GMT",
        },
      }),
    ]);
    const options = { userAgent: "BookOnBot/test", now, fetch: met.fetch, gapMs: 0 };
    const first = await refreshWeather(handle.db, [collier, unplaced], options);
    expect(first).toEqual({ fetched: 1, unchanged: 0, skipped: 1, failed: 0 });
    expect(met.calls[0]!.url).toBe(
      "https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=-32.0000&lon=115.8712",
    );
    expect(met.calls[0]!.headers["User-Agent"]).toBe("BookOnBot/test");

    const stored = (await forecastFor(handle.db, collier.id))!;
    expect(stored.hours[0]).toMatchObject({ temperature: 22.4, symbol: "fair_day", windKmh: 14 });
    expect(stored.expiresAt.toISOString()).toBe("2026-10-18T03:30:00.000Z");

    // Before it expires, nothing is asked.
    const again = await refreshWeather(handle.db, [collier], options);
    expect(again.skipped).toBe(1);
    expect(met.calls).toHaveLength(1);
  });

  it("sends If-Modified-Since and keeps the forecast on 304, and logs failures", async () => {
    const collier = (await findCourseBySlug(handle.db, "collier-park"))!;
    const met = fakeMet([
      new Response(JSON.stringify(body), {
        headers: { "last-modified": "Sun, 18 Oct 2026 02:55:00 GMT" },
      }),
      new Response(null, { status: 304, headers: { expires: "Sun, 18 Oct 2026 06:00:00 GMT" } }),
      new Response("busy", { status: 429 }),
    ]);
    const later = () => new Date("2026-10-18T05:00:00Z");
    await refreshWeather(handle.db, [collier], { userAgent: "t", now, fetch: met.fetch, gapMs: 0 });
    const unchanged = await refreshWeather(handle.db, [collier], {
      userAgent: "t",
      now: later,
      fetch: met.fetch,
      gapMs: 0,
    });
    expect(unchanged.unchanged).toBe(1);
    expect(met.calls[1]!.headers["If-Modified-Since"]).toBe("Sun, 18 Oct 2026 02:55:00 GMT");
    expect((await forecastFor(handle.db, collier.id))!.hours).toHaveLength(1);

    const failed = await refreshWeather(handle.db, [collier], {
      userAgent: "t",
      now: () => new Date("2026-10-18T07:00:00Z"),
      fetch: met.fetch,
      gapMs: 0,
    });
    expect(failed.failed).toBe(1);
  });
});
