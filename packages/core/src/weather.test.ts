import { describe, expect, it } from "vitest";
import {
  parseMetForecast,
  summariseWeather,
  weatherEmoji,
  weatherLine,
  weatherWords,
} from "./weather";

/**
 * Hand-written in the shape MET Norway documents for Locationforecast 2.0
 * "complete" (the cloud environment can't reach api.met.no). Times are UTC:
 * 22:00Z is 6 am in Perth.
 */
const sample = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [115.87, -31.99, 10] },
  properties: {
    meta: { updated_at: "2026-10-18T20:00:00Z", units: { air_temperature: "celsius" } },
    timeseries: [
      step("2026-10-18T22:00:00Z", 14.2, 3.0, { symbol: "clearsky_day", mm: 0, chance: 0 }),
      step("2026-10-18T23:00:00Z", 16.8, 4.2, { symbol: "fair_day", mm: 0, chance: 5 }),
      step("2026-10-19T00:00:00Z", 19.4, 5.5, {
        symbol: "lightrainshowers_day",
        mm: 0.3,
        chance: 40,
      }),
      step("2026-10-19T01:00:00Z", 21.0, 6.1, { symbol: "partlycloudy_day", mm: 0, chance: 10 }),
      // Further out, MET Norway only gives six-hour periods.
      {
        time: "2026-10-23T00:00:00Z",
        data: {
          instant: { details: { air_temperature: 24.6, wind_speed: 2.5 } },
          next_6_hours: {
            summary: { symbol_code: "rain" },
            details: { precipitation_amount: 4.2 },
          },
        },
      },
      // A step with no summary (the end of the series) is skipped.
      { time: "2026-10-28T00:00:00Z", data: { instant: { details: { air_temperature: 20 } } } },
    ],
  },
};

function step(
  time: string,
  temp: number,
  wind: number,
  p: { symbol: string; mm: number; chance: number },
) {
  return {
    time,
    data: {
      instant: { details: { air_temperature: temp, wind_speed: wind } },
      next_1_hours: {
        summary: { symbol_code: p.symbol },
        details: { precipitation_amount: p.mm, probability_of_precipitation: p.chance },
      },
    },
  };
}

describe("parseMetForecast", () => {
  it("reads hourly and six-hourly steps", () => {
    const hours = parseMetForecast(sample);
    expect(hours).toHaveLength(5);
    expect(hours[0]).toEqual({
      time: "2026-10-18T22:00:00.000Z",
      hours: 1,
      temperature: 14.2,
      symbol: "clearsky_day",
      rainMm: 0,
      rainChance: 0,
      windKmh: 11,
    });
    expect(hours[4]).toMatchObject({ hours: 6, symbol: "rain", rainMm: 4.2, rainChance: null });
  });

  it("refuses something that isn't a forecast", () => {
    expect(() => parseMetForecast({ error: "Not found" })).toThrow(/Not a MET Norway forecast/);
  });
});

describe("summariseWeather", () => {
  const hours = parseMetForecast(sample);

  it("sums up a tee time window: worst sky, warmest, most rain and wind", () => {
    // 6 am to 9 am Perth on Mon 19 Oct.
    const w = summariseWeather(
      hours,
      new Date("2026-10-18T22:00:00Z"),
      new Date("2026-10-19T01:00:00Z"),
    )!;
    expect(w).toEqual({
      symbol: "lightrainshowers_day",
      temperature: 21,
      rainChance: 40,
      rainMm: 0.3,
      windKmh: 22,
    });
    expect(weatherLine(w)).toBe("21° · 40% rain · 22 km/h wind");
    expect(weatherEmoji(w.symbol)).toBe("🌦️");
    expect(weatherWords(w.symbol)).toBe("Showers");
  });

  it("uses a six-hour period that overlaps the window", () => {
    const w = summariseWeather(
      hours,
      new Date("2026-10-23T02:00:00Z"),
      new Date("2026-10-23T03:00:00Z"),
    )!;
    expect(w.symbol).toBe("rain");
    expect(weatherLine(w)).toBe("25° · 4.2 mm rain · 9 km/h wind");
  });

  it("is null beyond the forecast", () => {
    expect(
      summariseWeather(hours, new Date("2026-11-20T00:00:00Z"), new Date("2026-11-20T04:00:00Z")),
    ).toBeNull();
  });

  it("picks simple emoji and words", () => {
    expect(weatherEmoji("clearsky_night")).toBe("☀️");
    expect(weatherEmoji("heavyrainandthunder")).toBe("⛈️");
    expect(weatherWords("fair_day")).toBe("Mostly sunny");
    expect(
      weatherLine({ symbol: "fair_day", temperature: 18, rainChance: null, rainMm: 0, windKmh: 9 }),
    ).toBe("18° · dry · 9 km/h wind");
  });
});
