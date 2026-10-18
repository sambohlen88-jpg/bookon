/**
 * Weather forecasts from MET Norway's Locationforecast 2.0 service
 * (https://api.met.no/weatherapi/locationforecast/2.0/documentation).
 * Free for commercial use with credit. The worker fetches them; the site
 * only reads what's stored.
 */

/** One step of a forecast: an hour for the next few days, then six hours. */
export interface WeatherHour {
  /** ISO, UTC: the start of the step. */
  time: string;
  /** Length of the step in hours (1 or 6), for rain totals and window overlap. */
  hours: number;
  /** °C. */
  temperature: number;
  /** MET Norway symbol code, e.g. "partlycloudy_day", "lightrain". */
  symbol: string;
  rainMm: number | null;
  /** 0 to 100, where MET Norway gives it. */
  rainChance: number | null;
  windKmh: number;
}

interface MetStep {
  time: string;
  data: {
    instant: { details: { air_temperature?: number; wind_speed?: number } };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
  };
}

interface MetPeriod {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number; probability_of_precipitation?: number };
}

/** Read a Locationforecast "compact" or "complete" response. Throws if it isn't one. */
export function parseMetForecast(json: unknown): WeatherHour[] {
  const steps = (json as { properties?: { timeseries?: MetStep[] } })?.properties?.timeseries;
  if (!Array.isArray(steps)) throw new Error("Not a MET Norway forecast: no timeseries");
  const out: WeatherHour[] = [];
  for (const step of steps) {
    const now = step.data?.instant?.details;
    const period = step.data?.next_1_hours ?? step.data?.next_6_hours;
    const symbol = period?.summary?.symbol_code;
    if (typeof now?.air_temperature !== "number" || !symbol) continue;
    out.push({
      time: new Date(step.time).toISOString(),
      hours: step.data.next_1_hours ? 1 : 6,
      temperature: now.air_temperature,
      symbol,
      rainMm: period?.details?.precipitation_amount ?? null,
      rainChance: period?.details?.probability_of_precipitation ?? null,
      windKmh: Math.round((now.wind_speed ?? 0) * 3.6),
    });
  }
  return out;
}

/** How bad a symbol is, for picking the one to show for a window. */
function severity(symbol: string): number {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return 6;
  if (/heavyrain|heavysleet|snow/.test(s)) return 5;
  if (/rain|sleet/.test(s) && !s.includes("showers")) return 4;
  if (s.includes("showers")) return 3;
  if (s === "fog" || s === "cloudy") return 2;
  if (s === "partlycloudy") return 1;
  return 0; // clearsky, fair
}

export interface WeatherSummary {
  symbol: string;
  /** Highest temperature in the window, rounded. */
  temperature: number;
  rainChance: number | null;
  rainMm: number;
  windKmh: number;
}

/**
 * The weather for a window of time, such as a search's 6 to 10 am: the worst
 * sky, the warmest temperature, the most rain and wind. Null when the
 * forecast doesn't reach that far.
 */
export function summariseWeather(
  forecast: WeatherHour[],
  from: Date,
  to: Date,
): WeatherSummary | null {
  const steps = forecast.filter((h) => {
    const start = Date.parse(h.time);
    const end = start + h.hours * 3_600_000;
    return start <= to.getTime() && end > from.getTime();
  });
  if (steps.length === 0) return null;
  const worst = steps.reduce((a, b) => (severity(b.symbol) > severity(a.symbol) ? b : a));
  const chances = steps.map((s) => s.rainChance).filter((c): c is number => c !== null);
  return {
    symbol: worst.symbol,
    temperature: Math.round(Math.max(...steps.map((s) => s.temperature))),
    rainChance: chances.length > 0 ? Math.round(Math.max(...chances)) : null,
    rainMm: Math.round(steps.reduce((n, s) => n + (s.rainMm ?? 0), 0) * 10) / 10,
    windKmh: Math.max(...steps.map((s) => s.windKmh)),
  };
}

/** An emoji for a symbol code. */
export function weatherEmoji(symbol: string): string {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return "⛈️";
  if (/snow|sleet/.test(s)) return "🌨️";
  if (s.includes("showers")) return "🌦️";
  if (s.includes("rain")) return "🌧️";
  if (s === "fog") return "🌫️";
  if (s === "cloudy") return "☁️";
  if (s === "partlycloudy") return "⛅";
  if (s === "fair") return "🌤️";
  return "☀️";
}

/** A word or two for a symbol code, for screen readers and alt text. */
export function weatherWords(symbol: string): string {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return "Thunder";
  if (/snow|sleet/.test(s)) return "Sleet";
  if (s.includes("showers")) return "Showers";
  if (s.startsWith("heavyrain")) return "Heavy rain";
  if (s.startsWith("lightrain")) return "Light rain";
  if (s.includes("rain")) return "Rain";
  if (s === "fog") return "Fog";
  if (s === "cloudy") return "Cloudy";
  if (s === "partlycloudy") return "Partly cloudy";
  if (s === "fair") return "Mostly sunny";
  return "Sunny";
}

/** "24° · 10% rain · 15 km/h wind", or "24° · dry · ..." when no rain is forecast. */
export function weatherLine(w: WeatherSummary): string {
  const rain =
    w.rainChance !== null ? `${w.rainChance}% rain` : w.rainMm > 0 ? `${w.rainMm} mm rain` : "dry";
  return `${w.temperature}° · ${rain} · ${w.windKmh} km/h wind`;
}
