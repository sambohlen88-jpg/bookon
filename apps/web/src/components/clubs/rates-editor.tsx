"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { RatesState } from "@/app/clubs/actions";
import { RATE_CATEGORIES } from "@/lib/rate-labels";
import { fieldLabel } from "@/components/form";
import { primaryButton, secondaryButton, textInput } from "@/components/ui";

export interface RateRow {
  key: number;
  category: string;
  name: string;
  price: string;
  unit: string;
  holes: string;
  days: string;
  daysOfWeek: number[];
  player: string;
  timeFrom: string;
  timeTo: string;
  validFrom: string;
  validTo: string;
  courseName: string;
  gstIncluded: boolean;
  notes: string;
}

const CATEGORIES = RATE_CATEGORIES;
const UNITS = {
  per_player: "per player",
  per_cart: "per cart",
  per_set: "per set",
  per_group: "per group",
  per_item: "each",
};
const DAYS = {
  any: "Any day",
  weekday: "Midweek (Mon–Fri)",
  weekend: "Weekends",
  public_holiday: "Public holidays",
  custom: "Pick days",
};
const PLAYERS = {
  any: "Anyone",
  adult: "Adult",
  senior: "Senior",
  concession: "Concession",
  junior: "Junior",
  student: "Student",
  member_guest: "Member's guest",
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type NewRow = Omit<RateRow, "key">;

function row(change: Partial<NewRow>): NewRow {
  return {
    category: "green_fee",
    name: "",
    price: "",
    unit: "per_player",
    holes: "",
    days: "any",
    daysOfWeek: [],
    player: "adult",
    timeFrom: "",
    timeTo: "",
    validFrom: "",
    validTo: "",
    courseName: "",
    gstIncluded: true,
    notes: "",
    ...change,
  };
}

/** One-tap starting points for common prices. */
const QUICK_ADD: { label: string; make: () => NewRow }[] = [
  { label: "Green fee", make: () => row({ name: "", holes: "18" }) },
  {
    label: "Twilight",
    make: () => row({ name: "Twilight", holes: "18", timeFrom: "15:00" }),
  },
  {
    label: "Cart hire",
    make: () =>
      row({
        category: "cart",
        name: "Cart, 18 holes",
        holes: "18",
        unit: "per_cart",
        player: "any",
      }),
  },
  {
    label: "Club hire",
    make: () => row({ category: "club_hire", name: "Club hire", unit: "per_set", player: "any" }),
  },
  {
    label: "Buggy or trolley",
    make: () => row({ category: "trolley", name: "Buggy hire", unit: "per_item", player: "any" }),
  },
  {
    label: "Deal",
    make: () => row({ category: "deal", name: "", days: "custom", player: "any" }),
  },
  { label: "Something else", make: () => row({ category: "other", player: "any" }) },
];

/** What a new club starts with: the usual lines, prices left blank to fill in. */
function starterRates(): NewRow[] {
  return [
    row({ name: "18 holes midweek", holes: "18", days: "weekday" }),
    row({ name: "18 holes weekend", holes: "18", days: "weekend" }),
    row({ name: "9 holes midweek", holes: "9", days: "weekday" }),
    row({ name: "9 holes weekend", holes: "9", days: "weekend" }),
    row({ name: "18 holes senior midweek", holes: "18", days: "weekday", player: "senior" }),
    row({ name: "Twilight", holes: "18", timeFrom: "15:00" }),
    row({ category: "cart", name: "Cart, 18 holes", holes: "18", unit: "per_cart", player: "any" }),
    row({ category: "club_hire", name: "Club hire", unit: "per_set", player: "any" }),
  ];
}

/** A saved price line, as the page passes it in. */
export interface SavedRate {
  category: string;
  name: string;
  priceCents: number;
  unit: string;
  holes: number | null;
  days: string;
  daysOfWeek: number[] | null;
  player: string;
  timeFrom: string | null;
  timeTo: string | null;
  validFrom: string | null;
  validTo: string | null;
  courseName: string | null;
  gstIncluded: boolean;
  notes: string | null;
}

function rateRowFrom(saved: SavedRate): NewRow {
  return row({
    category: saved.category,
    name: saved.name,
    price: (saved.priceCents / 100).toFixed(2),
    unit: saved.unit,
    holes: saved.holes ? String(saved.holes) : "",
    days: saved.days,
    daysOfWeek: saved.daysOfWeek ?? [],
    player: saved.player,
    timeFrom: saved.timeFrom?.slice(0, 5) ?? "",
    timeTo: saved.timeTo?.slice(0, 5) ?? "",
    validFrom: saved.validFrom ?? "",
    validTo: saved.validTo ?? "",
    courseName: saved.courseName ?? "",
    gstIncluded: saved.gstIncluded,
    notes: saved.notes ?? "",
  });
}

function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={textInput}
      >
        {Object.entries(options).map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The club's price list: green fees by day, time and player, carts, hire,
 * deals. Lines without a price aren't saved, so the starter lines can be
 * left blank if they don't apply.
 */
export function RatesEditor({
  action: save,
  hidden,
  saved,
  courseNames,
  backHref,
  submitLabel = "Save and continue",
}: {
  /** Saves the list. Returns problems to show, or redirects when done. */
  action: (prev: RatesState, form: FormData) => Promise<RatesState>;
  /** Extra form fields the action needs, such as the listing's token. */
  hidden: Record<string, string>;
  saved: SavedRate[];
  courseNames: string[];
  backHref?: string;
  submitLabel?: string;
}) {
  // Keys number from 1 in order, so the server's page and the browser agree on field ids.
  const [rows, setRows] = useState<RateRow[]>(() =>
    (saved.length > 0 ? saved.map(rateRowFrom) : starterRates()).map((r, i) => ({
      ...r,
      key: i + 1,
    })),
  );
  const lastKey = useRef(rows.length);
  const add = (r: NewRow) => setRows((rs) => [...rs, { ...r, key: ++lastKey.current }]);
  const [state, action, pending] = useActionState<RatesState, FormData>(save, null);
  const update = (key: number, change: Partial<RateRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const priced = rows.filter((r) => r.price.trim() !== "");
  const skipped = rows.length - priced.length;

  return (
    <form action={action} className="flex flex-col gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        type="hidden"
        name="rates"
        value={JSON.stringify(
          priced.map((r) => ({
            ...r,
            holes: r.holes || null,
            price: r.price,
            courseName: r.courseName || null,
          })),
        )}
      />

      {rows.map((r, i) => {
        const id = (field: string) => `r-${r.key}-${field}`;
        const more = Boolean(
          r.timeFrom ||
          r.timeTo ||
          r.validFrom ||
          r.validTo ||
          r.notes ||
          r.courseName ||
          !r.gstIncluded,
        );
        return (
          <fieldset key={r.key} className="rounded-xl border border-border p-4">
            <legend className="px-1 font-semibold">
              {r.name || CATEGORIES[r.category as keyof typeof CATEGORIES]}{" "}
              <span className="font-normal text-muted">· line {i + 1}</span>
            </legend>
            <div className="grid gap-4 md:grid-cols-[1.2fr_2fr_1fr_1fr]">
              <Choice
                id={id("category")}
                label="What for"
                value={r.category}
                options={CATEGORIES}
                onChange={(category) => update(r.key, { category })}
              />
              <div>
                <label htmlFor={id("name")} className={fieldLabel}>
                  Name golfers see
                </label>
                <input
                  id={id("name")}
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  maxLength={120}
                  placeholder="For example: 18 holes midweek"
                  className={textInput}
                />
              </div>
              <div>
                <label htmlFor={id("price")} className={fieldLabel}>
                  Price ($)
                </label>
                <input
                  id={id("price")}
                  value={r.price}
                  inputMode="decimal"
                  onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d.]/g, "") })}
                  placeholder="0.00"
                  className={textInput}
                />
              </div>
              <Choice
                id={id("unit")}
                label="Per"
                value={r.unit}
                options={UNITS}
                onChange={(unit) => update(r.key, { unit })}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Choice
                id={id("holes")}
                label="Holes"
                value={r.holes}
                options={{ "": "Doesn't matter", "9": "9 holes", "18": "18 holes" }}
                onChange={(holes) => update(r.key, { holes })}
              />
              <Choice
                id={id("days")}
                label="Days"
                value={r.days}
                options={DAYS}
                onChange={(days) => update(r.key, { days })}
              />
              <Choice
                id={id("player")}
                label="Who"
                value={r.player}
                options={PLAYERS}
                onChange={(player) => update(r.key, { player })}
              />
            </div>
            {r.days === "custom" && (
              <fieldset className="mt-4">
                <legend className={fieldLabel}>Which days</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day, d) => {
                    const on = r.daysOfWeek.includes(d + 1);
                    return (
                      <label
                        key={day}
                        className={`flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium ${on ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            update(r.key, {
                              daysOfWeek: on
                                ? r.daysOfWeek.filter((x) => x !== d + 1)
                                : [...r.daysOfWeek, d + 1],
                            })
                          }
                        />
                        {day}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <details className="mt-4" open={more || r.category === "deal"}>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand">
                Times, dates, course and notes
              </summary>
              <div className="mt-2 grid gap-4 md:grid-cols-4">
                <div>
                  <label htmlFor={id("timeFrom")} className={fieldLabel}>
                    From (time)
                  </label>
                  <input
                    id={id("timeFrom")}
                    type="time"
                    value={r.timeFrom}
                    onChange={(e) => update(r.key, { timeFrom: e.target.value })}
                    className={textInput}
                  />
                </div>
                <div>
                  <label htmlFor={id("timeTo")} className={fieldLabel}>
                    Until (time)
                  </label>
                  <input
                    id={id("timeTo")}
                    type="time"
                    value={r.timeTo}
                    onChange={(e) => update(r.key, { timeTo: e.target.value })}
                    className={textInput}
                  />
                </div>
                <div>
                  <label htmlFor={id("validFrom")} className={fieldLabel}>
                    First date
                  </label>
                  <input
                    id={id("validFrom")}
                    type="date"
                    value={r.validFrom}
                    onChange={(e) => update(r.key, { validFrom: e.target.value })}
                    className={textInput}
                  />
                </div>
                <div>
                  <label htmlFor={id("validTo")} className={fieldLabel}>
                    Last date
                  </label>
                  <input
                    id={id("validTo")}
                    type="date"
                    value={r.validTo}
                    onChange={(e) => update(r.key, { validTo: e.target.value })}
                    className={textInput}
                  />
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">
                Leave these empty if the price applies all day, all year.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {courseNames.length > 1 && (
                  <Choice
                    id={id("course")}
                    label="Course"
                    value={r.courseName}
                    options={{
                      "": "All courses",
                      ...Object.fromEntries(courseNames.map((n) => [n, n])),
                    }}
                    onChange={(courseName) => update(r.key, { courseName })}
                  />
                )}
                <div>
                  <label htmlFor={id("notes")} className={fieldLabel}>
                    Notes or conditions
                  </label>
                  <input
                    id={id("notes")}
                    value={r.notes}
                    onChange={(e) => update(r.key, { notes: e.target.value })}
                    maxLength={500}
                    placeholder="For example: includes a drink at the bar"
                    className={textInput}
                  />
                </div>
              </div>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={r.gstIncluded}
                  onChange={(e) => update(r.key, { gstIncluded: e.target.checked })}
                  className="size-5 accent-brand"
                />
                Price includes GST
              </label>
            </details>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              className={`${secondaryButton} mt-2`}
            >
              Remove this line
            </button>
          </fieldset>
        );
      })}

      <div className="rounded-xl bg-surface p-4">
        <p className="text-sm font-medium">Add a price</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_ADD.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => add(q.make())}
              className={`${secondaryButton} bg-background`}
            >
              + {q.label}
            </button>
          ))}
        </div>
      </div>

      {skipped > 0 && (
        <p className="text-sm text-muted" role="status">
          {skipped} {skipped === 1 ? "line has" : "lines have"} no price yet and won&apos;t be
          saved.
        </p>
      )}
      {state && "saved" in state && (
        <p role="status" className="text-sm font-medium text-brand">
          Saved.
        </p>
      )}
      {state && "problems" in state && (
        <div
          role="alert"
          className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-fg"
        >
          <p className="font-semibold">Please check:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${primaryButton} disabled:opacity-60`}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {backHref && (
          <Link href={backHref} className={secondaryButton}>
            Back
          </Link>
        )}
      </div>
    </form>
  );
}
