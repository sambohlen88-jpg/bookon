import { eq, inArray } from "drizzle-orm";
import type { WeatherHour } from "@bookon/core";
import type { Database } from "./client";
import { weatherForecasts } from "./schema";

export interface StoredForecast {
  courseId: string;
  fetchedAt: Date;
  expiresAt: Date;
  lastModified: string | null;
  hours: WeatherHour[];
}

export async function saveForecast(db: Database, forecast: StoredForecast): Promise<void> {
  await db
    .insert(weatherForecasts)
    .values(forecast)
    .onConflictDoUpdate({
      target: weatherForecasts.courseId,
      set: {
        fetchedAt: forecast.fetchedAt,
        expiresAt: forecast.expiresAt,
        lastModified: forecast.lastModified,
        hours: forecast.hours,
      },
    });
}

/** The forecast hasn't changed (HTTP 304): only when to ask next. */
export async function extendForecast(db: Database, courseId: string, expiresAt: Date) {
  await db
    .update(weatherForecasts)
    .set({ expiresAt })
    .where(eq(weatherForecasts.courseId, courseId));
}

export async function forecastFor(db: Database, courseId: string): Promise<StoredForecast | null> {
  const [row] = await db
    .select()
    .from(weatherForecasts)
    .where(eq(weatherForecasts.courseId, courseId));
  return row ?? null;
}

/** Forecast steps per course. Courses without a forecast are left out. */
export async function forecastsFor(
  db: Database,
  courseIds: string[],
): Promise<Map<string, WeatherHour[]>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db
    .select({ courseId: weatherForecasts.courseId, hours: weatherForecasts.hours })
    .from(weatherForecasts)
    .where(inArray(weatherForecasts.courseId, courseIds));
  return new Map(rows.map((r) => [r.courseId, r.hours]));
}
