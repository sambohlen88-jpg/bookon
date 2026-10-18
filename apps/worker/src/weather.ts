import { parseMetForecast } from "@bookon/core";
import { extendForecast, forecastFor, saveForecast, type Database } from "@bookon/db";

/**
 * Keep each course's forecast from MET Norway fresh. Their terms
 * (https://api.met.no/doc/TermsOfService): say who we are in the user agent,
 * don't ask before the Expires time, send If-Modified-Since, keep it gentle,
 * and credit them where the weather is shown.
 */
export const MET_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
/** If MET Norway gives no Expires header, ask again after this long. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const GAP_MS = 1000;

export interface WeatherCourse {
  id: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

export interface WeatherResult {
  fetched: number;
  unchanged: number;
  /** Fetched recently: MET Norway's forecast hasn't expired yet. */
  fresh: number;
  /** No latitude and longitude yet, so no forecast (set them in admin). */
  noLocation: number;
  failed: number;
}

export async function refreshWeather(
  db: Database,
  courses: WeatherCourse[],
  options: {
    userAgent: string;
    now?: () => Date;
    fetch?: typeof fetch;
    gapMs?: number;
  },
): Promise<WeatherResult> {
  const now = options.now ?? (() => new Date());
  const get = options.fetch ?? fetch;
  const result: WeatherResult = { fetched: 0, unchanged: 0, fresh: 0, noLocation: 0, failed: 0 };
  let asked = false;
  for (const course of courses) {
    if (course.latitude === null || course.longitude === null) {
      result.noLocation++;
      continue;
    }
    const stored = await forecastFor(db, course.id);
    if (stored && stored.expiresAt > now()) {
      result.fresh++;
      continue;
    }
    if (asked) await new Promise((r) => setTimeout(r, options.gapMs ?? GAP_MS));
    asked = true;
    // MET Norway asks for no more than 4 decimals, so nearby requests share a cache.
    const url = `${MET_FORECAST_URL}?lat=${course.latitude.toFixed(4)}&lon=${course.longitude.toFixed(4)}`;
    try {
      const response = await get(url, {
        headers: {
          "User-Agent": options.userAgent,
          ...(stored?.lastModified ? { "If-Modified-Since": stored.lastModified } : {}),
        },
      });
      const expires = expiresAt(response.headers.get("expires"), now());
      if (response.status === 304 && stored) {
        await extendForecast(db, course.id, expires);
        result.unchanged++;
      } else if (response.ok) {
        await saveForecast(db, {
          courseId: course.id,
          fetchedAt: now(),
          expiresAt: expires,
          lastModified: response.headers.get("last-modified"),
          hours: parseMetForecast(await response.json()),
        });
        result.fetched++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      result.failed++;
      console.error(`[weather] ${course.slug}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return result;
}

function expiresAt(header: string | null, now: Date): Date {
  const parsed = header ? Date.parse(header) : NaN;
  // Never sooner than 10 minutes, in case a clock or header is off.
  const earliest = now.getTime() + 10 * 60 * 1000;
  return new Date(
    Number.isNaN(parsed) ? now.getTime() + DEFAULT_TTL_MS : Math.max(parsed, earliest),
  );
}
