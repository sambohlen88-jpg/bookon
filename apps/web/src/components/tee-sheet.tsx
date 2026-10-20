import Link from "next/link";
import {
  formatAgo,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  weatherEmoji,
  weatherWords,
  type WeatherHour,
} from "@bookon/core";
import { DAY_PARTS, type CourseResult } from "@bookon/db";
import { bookLink } from "@/lib/click-token";
import { dayLabel } from "@/lib/coaches";
import {
  GROUP_SIZE,
  SESSION_CHOICES,
  dayBays,
  sheetHours,
  sheetHref,
  spots,
  weatherAt,
  type SheetDay,
  type SheetOptions,
} from "@/lib/tee-sheet";

const chip =
  "flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-medium";
const chipOn = "border-brand bg-brand text-brand-foreground";
const chipOff = "border-border";

/** One line of filter chips; on phones it scrolls sideways rather than wrapping. */
function FilterRow({
  label,
  name,
  children,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex items-center gap-2 pb-1" role="group" aria-label={name ?? label}>
        <span className="w-20 shrink-0 text-sm text-muted">{label}</span>
        {children}
      </div>
    </div>
  );
}

const DAY_NOTE: Record<SheetDay["status"], string> = {
  times: "",
  none: "Full",
  "not-open": "Not out yet",
  unknown: "Not checked",
};

/**
 * The tee sheet on a course page (Milestone 17): a day strip, filters, and
 * every free time that day grouped by hour, each with its player spots and a
 * Book link. Only times with room are shown. Sims and ranges get a bay grid.
 */
export function TeeSheet({
  slug,
  courseId,
  courseName,
  venue,
  indoor,
  result,
  days,
  options,
  forecast,
  now,
}: {
  slug: string;
  courseId: string;
  courseName: string;
  venue: boolean;
  /** Simulators are indoors: no weather. */
  indoor: boolean;
  result: CourseResult | undefined;
  days: SheetDay[];
  options: SheetOptions & { day: string };
  forecast: WeatherHour[] | undefined;
  now: Date;
}) {
  const href = (change: Partial<SheetOptions>) => sheetHref(slug, options, change);
  const sheet = sheetHours(result?.teeTimes ?? [], options.day, options);
  const chosen = days.find((d) => d.date === options.day);
  const bays = venue ? dayBays(sheet.hours.flatMap((h) => h.times)) : [];
  const book = (startTime: Date, url: string) =>
    bookLink({ courseId, startTime: startTime.toISOString(), url, source: "directory" });

  return (
    <section id="tee-sheet" aria-labelledby="tee-sheet-heading" className="mt-8 scroll-mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tee-sheet-heading" className="text-xl font-semibold">
          {venue ? "Free bays" : "Tee sheet"}
        </h2>
        {result?.checkedAt && (
          <p className="text-sm text-muted">Checked {formatAgo(result.checkedAt, now)}</p>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {venue
          ? "Every free bay for the day. Tap one to book it on the venue's page."
          : "Every time with room for your group. Full times aren't shown. Tap Book to finish on the club's page."}
      </p>

      {/* Days: a strip that scrolls sideways on phones. */}
      <nav aria-label="Days" className="-mx-4 mt-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ol className="flex gap-2 pb-1">
          {days.map((d) => {
            const on = d.date === options.day;
            return (
              <li key={d.date}>
                <Link
                  href={href({ day: d.date })}
                  scroll={false}
                  aria-current={on ? "date" : undefined}
                  className={`flex w-[4.75rem] flex-col items-center rounded-xl border py-2 text-sm ${
                    on ? chipOn : d.status === "times" ? chipOff : "border-border text-muted"
                  }`}
                >
                  <span>{dayLabel(d.date)}</span>
                  <span className="text-lg font-semibold">{Number(d.date.slice(8))}</span>
                  <span className="text-xs">
                    {d.status === "times" ? `${d.count} free` : DAY_NOTE[d.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Filters. */}
      <div className="mt-4 flex flex-col gap-3">
        <FilterRow label="Players">
          {Array.from({ length: venue ? 6 : GROUP_SIZE }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={href({ players: n })}
              scroll={false}
              aria-current={options.players === n ? "true" : undefined}
              className={`${chip} w-11 px-0 ${options.players === n ? chipOn : chipOff}`}
            >
              {n}
            </Link>
          ))}
        </FilterRow>
        {venue ? (
          <FilterRow label="How long">
            {SESSION_CHOICES.map((m) => (
              <Link
                key={m}
                href={href({ minutes: m })}
                scroll={false}
                aria-current={options.minutes === m ? "true" : undefined}
                className={`${chip} ${options.minutes === m ? chipOn : chipOff}`}
              >
                {m === 30 ? "30 min" : m === 60 ? "1 hr" : m === 90 ? "1½ hr" : "2 hr"}
              </Link>
            ))}
          </FilterRow>
        ) : (
          <FilterRow label="Holes">
            {([null, 18, 9] as const).map((h) => (
              <Link
                key={h ?? "any"}
                href={href({ holes: h })}
                scroll={false}
                aria-current={options.holes === h ? "true" : undefined}
                className={`${chip} ${options.holes === h ? chipOn : chipOff}`}
              >
                {h ? `${h} holes` : "Any"}
              </Link>
            ))}
          </FilterRow>
        )}
        {sheet.layouts.length > 1 && (
          <FilterRow label="Course">
            {[null, ...sheet.layouts].map((l) => (
              <Link
                key={l ?? "all"}
                href={href({ layout: l })}
                scroll={false}
                aria-current={sheet.layout === l ? "true" : undefined}
                className={`${chip} ${sheet.layout === l ? chipOn : chipOff}`}
              >
                {l ?? "All"}
              </Link>
            ))}
          </FilterRow>
        )}
        {/* Time of day: also how you jump down a long day. */}
        <FilterRow label="When" name="Time of day">
          {[{ id: null, name: "All day" }, ...DAY_PARTS].map((p) => (
            <Link
              key={p.id ?? "all"}
              href={href({ part: p.id })}
              scroll={false}
              aria-current={options.part === p.id ? "true" : undefined}
              className={`${chip} ${options.part === p.id ? chipOn : chipOff}`}
            >
              {p.name}
            </Link>
          ))}
        </FilterRow>
      </div>

      {/* The day. */}
      <h3 className="mt-6 font-semibold">
        {formatPerthDay(options.day)}
        {sheet.total > 0 && (
          <span className="font-normal text-muted">
            {" "}
            · {sheet.total} {venue ? "start " : ""}
            {sheet.total === 1 ? "time" : "times"} free
          </span>
        )}
      </h3>

      {sheet.total === 0 ? (
        <p className="mt-3 rounded-xl border border-border px-4 py-4 text-muted">
          {chosen?.status === "not-open"
            ? "The club hasn't released this day yet."
            : chosen?.status === "unknown"
              ? "We couldn't check this day just now. Try the club's own page."
              : options.part || sheet.layout
                ? "Nothing free then. Try another time of day."
                : venue
                  ? "No free bays that day for that long."
                  : `Nothing free that day for ${options.players} ${options.players === 1 ? "player" : "players"}.`}
        </p>
      ) : venue ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 bg-background px-3 py-2 text-left font-semibold"
                >
                  Start
                </th>
                {bays.map((b) => (
                  <th
                    key={b}
                    scope="col"
                    className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                  >
                    Bay {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.hours
                .flatMap((h) => h.times)
                .map((t) => (
                  <tr key={t.startTime.toISOString()} className="border-t border-border">
                    <th
                      scope="row"
                      className="sticky left-0 bg-background px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums"
                    >
                      {formatPerthTime(t.startTime)}
                      {t.priceCents !== null && (
                        <span className="block text-xs font-normal text-muted">
                          {formatPrice(t.priceCents)} an hour
                        </span>
                      )}
                    </th>
                    {bays.map((b) => (
                      <td key={b} className="px-1 py-1.5 text-center">
                        {t.bays?.includes(b) ? (
                          <a
                            href={book(t.startTime, t.bookingUrl)}
                            target="_blank"
                            rel="noopener"
                            aria-label={`Book bay ${b} at ${formatPerthTime(t.startTime)}, ${courseName} (opens the venue's site)`}
                            className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-lg bg-brand px-2 font-semibold text-brand-foreground"
                          >
                            Free
                          </a>
                        ) : (
                          <span className="text-muted" aria-label="Booked">
                            ·
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {sheet.hours.map((h) => {
            const w = indoor ? null : weatherAt(forecast, h.startsAt);
            return (
              <section
                key={h.hour}
                aria-label={h.label}
                className="rounded-xl border border-border"
              >
                <h4 className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-border bg-surface px-4 py-2 text-sm">
                  <span className="font-semibold">{h.label}</span>
                  {w && (
                    <span className="text-muted">
                      <span role="img" aria-label={weatherWords(w.symbol)}>
                        {weatherEmoji(w.symbol)}
                      </span>{" "}
                      {Math.round(w.temperature)}° · {Math.round(w.windKmh)} km/h wind
                      {w.rainChance !== null && w.rainChance >= 20
                        ? ` · ${w.rainChance}% rain`
                        : w.rainMm !== null && w.rainMm >= 0.5
                          ? ` · ${w.rainMm} mm rain`
                          : ""}
                    </span>
                  )}
                </h4>
                <ul className="tee-list px-4">
                  {h.times.map((t, i) => (
                    <li
                      key={`${t.startTime.toISOString()}-${t.holes}-${t.layout}-${i}`}
                      className="tee-row"
                    >
                      <span className="tee-time">{formatPerthTime(t.startTime)}</span>
                      <span className="tee-info">
                        <span
                          className="flex items-center gap-1"
                          aria-label={`${t.spotsAvailable} of ${GROUP_SIZE} spots free`}
                        >
                          {spots(t.spotsAvailable).map((free, n) => (
                            <span
                              key={n}
                              aria-hidden
                              className={`size-3 rounded-full border ${free ? "border-brand" : "border-muted bg-muted"}`}
                            />
                          ))}
                          <span className="ml-1 text-xs text-muted">{t.spotsAvailable} free</span>
                        </span>
                        <span className="text-muted">
                          {t.holes} holes{t.layout ? ` · ${t.layout}` : ""} ·{" "}
                          {t.priceCents === null ? "Price at club" : formatPrice(t.priceCents)}
                        </span>
                      </span>
                      <a
                        href={book(t.startTime, t.bookingUrl)}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Book ${formatPerthTime(t.startTime)} at ${courseName} (opens the club's site)`}
                        className="tee-book"
                      >
                        Book
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {!venue && !indoor && forecast && sheet.total > 0 && (
        <p className="mt-2 text-xs text-muted">
          Weather from{" "}
          <a href="https://www.met.no/en" className="underline">
            MET Norway
          </a>
          .
        </p>
      )}
    </section>
  );
}
