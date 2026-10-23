import { AREAS, addPerthDays, perthDate } from "@bookon/core";
import type { SearchableCourse } from "@bookon/db";
import {
  DAY_OPTIONS,
  LATEST_BAY_TIME,
  LATEST_TIME,
  MAX_DAYS_AHEAD,
  SESSION_OPTIONS,
  TIME_OPTIONS,
  formatFormTime,
  kindPlays,
  quickDays,
  type Near,
  type SearchForm as SearchFormValues,
} from "@/lib/search-form";
import { NearMe, PlaySwitch, QuickDays } from "@/components/search-extras";

const fieldLabel = "block text-sm font-medium mb-1.5";
const control =
  "w-full min-h-12 rounded-lg border border-border bg-background px-3 text-base text-foreground";

/**
 * The whole search as a plain GET form, so it works before any JavaScript
 * loads and every search has a shareable URL.
 */
export function SearchForm({
  values,
  courses,
  now,
  favourites = 0,
  mine = false,
  idPrefix = "",
  near = null,
  sort,
  pinButton = false,
}: {
  values: SearchFormValues;
  courses: SearchableCourse[];
  now: Date;
  /** How many courses the signed-in golfer has starred. */
  favourites?: number;
  /** Search only those courses. */
  mine?: boolean;
  /** Keeps ids unique when a page has two forms (one for phones, one for desktop). */
  idPrefix?: string;
  /** This search's Near me location, to keep it switched on. */
  near?: Near | null;
  /** Keep the button in view at the bottom of a scrolling side panel (the search page on desktop). */
  pinButton?: boolean;
  /** The results' sort, to keep when the search changes. Left out for the usual order. */
  sort?: string;
}) {
  const id = (name: string) => `${idPrefix}${name}`;
  const today = perthDate(now);
  const areas = AREAS.filter((a) => courses.some((c) => c.area === a.id));
  const located = courses.some((c) => c.latitude !== null);
  const golf = courses.filter((c) => kindPlays(c.kind, "golf"));
  const bays = courses.filter((c) => kindPlays(c.kind, "bays"));
  return (
    <form action="/search" method="get" className="search-form flex flex-col gap-5">
      {sort && <input type="hidden" name="sort" value={sort} />}
      {bays.length > 0 && (
        <PlaySwitch
          initial={values.play}
          toId={id("to")}
          latest={{ golf: LATEST_TIME, bays: LATEST_BAY_TIME }}
        />
      )}
      {/* Phones only: on desktop the date picker is right there. */}
      <div className="lg:hidden">
        <QuickDays inputId={id("date")} days={quickDays(now)} initial={values.date} />
      </div>
      <div className="-mt-2 grid grid-cols-2 gap-3 lg:mt-0">
        <div>
          <label htmlFor={id("date")} className={fieldLabel}>
            Day
          </label>
          <input
            id={id("date")}
            name="date"
            type="date"
            required
            defaultValue={values.date}
            min={today}
            max={addPerthDays(today, MAX_DAYS_AHEAD - 1)}
            className={control}
          />
        </div>
        <div>
          <label htmlFor={id("days")} className={fieldLabel}>
            Flexible?
          </label>
          <select id={id("days")} name="days" defaultValue={values.days} className={control}>
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("from")} className={fieldLabel}>
            Earliest
          </label>
          <select id={id("from")} name="from" defaultValue={values.from} className={control}>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {formatFormTime(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("to")} className={fieldLabel}>
            Latest
          </label>
          <select id={id("to")} name="to" defaultValue={values.to} className={control}>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {formatFormTime(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Choice
        legend="Players"
        name="players"
        value={String(values.players)}
        options={["1", "2", "3", "4", "5", "6"].map((v) => ({
          value: v,
          label: v,
          // Bays take up to 6; a tee time takes 4.
          className: Number(v) > 4 ? "play-bays" : undefined,
        }))}
      />

      <Choice
        legend="Holes"
        name="holes"
        value={values.holes}
        className="play-golf"
        options={[
          { value: "any", label: "Either" },
          { value: "9", label: "9" },
          { value: "18", label: "18" },
        ]}
      />

      {bays.length > 0 && (
        <Choice
          legend="How long"
          name="mins"
          value={String(values.minutes)}
          className="play-bays"
          options={SESSION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        />
      )}

      {areas.length > 1 && (
        // min-w-0: fieldsets don't shrink by default, which would let the row widen the page.
        <fieldset className="min-w-0">
          <legend className={fieldLabel}>Where</legend>
          {/* relative: keeps the hidden radio buttons inside the scrolling row. */}
          {/* A scrolling row on phones; on desktop the areas wrap, with no scroll bar. */}
          <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
            {[{ id: "", name: "Anywhere" }, ...areas].map((a) => (
              <label key={a.id} className="relative shrink-0">
                <input
                  type="radio"
                  name="area"
                  value={a.id}
                  defaultChecked={(values.area ?? "") === a.id}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 cursor-pointer items-center rounded-full border border-border px-4 text-sm font-medium whitespace-nowrap peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-foreground peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
                  {a.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {located && <NearMe initial={near} />}

      {favourites > 0 && (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={mine}
            className="size-5 accent-brand"
          />
          <span>
            My courses only <span className="text-muted">· {favourites} starred</span>
          </span>
        </label>
      )}

      {(
        [
          { play: "golf", list: golf, noun: "Courses" },
          { play: "bays", list: bays, noun: "Venues" },
        ] as const
      ).map(({ play, list, noun }) => {
        if (list.length < 2) return null;
        const mine = values.play === play;
        return (
          <details key={play} className={`play-${play} rounded-lg border border-border`}>
            <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-medium">
              {noun}:{" "}
              {mine && values.area
                ? `all in ${AREAS.find((a) => a.id === values.area)?.name}`
                : !mine || values.courses.length === 0
                  ? "all"
                  : `${values.courses.length} chosen`}
            </summary>
            <fieldset className="flex flex-col border-t border-border px-3 py-2 lg:max-h-80 lg:overflow-y-auto">
              <legend className="sr-only">{noun} to search</legend>
              {list.map((course) => (
                <label key={course.slug} className="flex min-h-11 items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    name="course"
                    value={course.slug}
                    defaultChecked={mine && !values.area && values.courses.includes(course.slug)}
                    className="size-5 accent-brand"
                  />
                  <span>
                    {course.name} <span className="text-muted">· {course.suburb}</span>
                  </span>
                </label>
              ))}
              <p className="py-2 text-sm text-muted">
                Ticked {noun.toLowerCase()} are searched instead of an area. Leave all unticked to
                search{" "}
                {areas.length > 1
                  ? "the area you picked"
                  : `every ${noun === "Courses" ? "course" : "venue"}`}
                .
              </p>
            </fieldset>
          </details>
        );
      })}

      <div
        className={
          pinButton
            ? "sticky -bottom-5 -mx-5 -mb-5 flex flex-col border-t border-border bg-background px-5 pb-5 pt-3"
            : "flex flex-col"
        }
      >
        <button
          type="submit"
          className="min-h-12 rounded-lg bg-brand px-4 text-base font-semibold text-brand-foreground"
        >
          <span className="play-golf">Find tee times</span>
          <span className="play-bays">Find a bay</span>
        </button>
      </div>
    </form>
  );
}

/** Radio buttons drawn as a row of large buttons. */
function Choice({
  legend,
  name,
  value,
  options,
  className,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string; className?: string }[];
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className={fieldLabel}>{legend}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex-1 ${o.className ?? ""}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === value}
              className="peer sr-only"
            />
            <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-border text-base font-medium peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-foreground peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
