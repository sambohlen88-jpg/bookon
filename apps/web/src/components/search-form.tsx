import { AREAS, addPerthDays, perthDate } from "@bookon/core";
import type { SearchableCourse } from "@bookon/db";
import {
  DAY_OPTIONS,
  MAX_DAYS_AHEAD,
  TIME_OPTIONS,
  formatFormTime,
  quickDays,
  type Near,
  type SearchForm as SearchFormValues,
} from "@/lib/search-form";
import { NearMe, QuickDays } from "@/components/search-extras";

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
}) {
  const id = (name: string) => `${idPrefix}${name}`;
  const today = perthDate(now);
  const areas = AREAS.filter((a) => courses.some((c) => c.area === a.id));
  const located = courses.some((c) => c.latitude !== null);
  return (
    <form action="/search" method="get" className="flex flex-col gap-5">
      <QuickDays inputId={id("date")} days={quickDays(now)} initial={values.date} />
      <div className="-mt-2 grid grid-cols-2 gap-3">
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
        options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))}
      />

      <Choice
        legend="Holes"
        name="holes"
        value={values.holes}
        options={[
          { value: "any", label: "Either" },
          { value: "9", label: "9" },
          { value: "18", label: "18" },
        ]}
      />

      {areas.length > 1 && (
        // min-w-0: fieldsets don't shrink by default, which would let the row widen the page.
        <fieldset className="min-w-0">
          <legend className={fieldLabel}>Where</legend>
          {/* relative: keeps the hidden radio buttons inside the scrolling row. */}
          <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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

      {courses.length > 1 && (
        <details className="rounded-lg border border-border">
          <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-medium">
            Courses:{" "}
            {values.area
              ? `all in ${AREAS.find((a) => a.id === values.area)?.name}`
              : values.courses.length === 0
                ? "all"
                : `${values.courses.length} chosen`}
          </summary>
          <fieldset className="flex flex-col border-t border-border px-3 py-2 lg:max-h-80 lg:overflow-y-auto">
            <legend className="sr-only">Courses to search</legend>
            {courses.map((course) => (
              <label key={course.slug} className="flex min-h-11 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  name="course"
                  value={course.slug}
                  defaultChecked={!values.area && values.courses.includes(course.slug)}
                  className="size-5 accent-brand"
                />
                <span>
                  {course.name} <span className="text-muted">· {course.suburb}</span>
                </span>
              </label>
            ))}
            <p className="py-2 text-sm text-muted">
              Ticked courses are searched instead of an area. Leave all unticked to search{" "}
              {areas.length > 1 ? "the area you picked" : "every course"}.
            </p>
          </fieldset>
        </details>
      )}

      <button
        type="submit"
        className="min-h-12 rounded-lg bg-brand px-4 text-base font-semibold text-brand-foreground"
      >
        Find tee times
      </button>
    </form>
  );
}

/** Radio buttons drawn as a row of large buttons. */
function Choice({
  legend,
  name,
  value,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset>
      <legend className={fieldLabel}>{legend}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex-1">
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
