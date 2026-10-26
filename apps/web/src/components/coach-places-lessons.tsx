"use client";

/**
 * The coach portal's "Where you teach" and "Lessons and rates" (Milestone 26):
 * places and lessons are added one at a time, a coach can say they're happy
 * to travel, and each lesson can be at some places only. Field names are
 * numbered by position, which is what parseCoachForm reads.
 */
import { useEffect, useRef, useState } from "react";
import { AREAS } from "@bookon/core/areas";
import {
  LESSON_KINDS,
  MAX_COACH_LESSONS,
  MAX_COACH_PLACES,
  PLAYER_CHOICE,
  guessLessonKind,
  placeKey,
  type CoachPlace,
  type CoachRate,
  type CoachTravel,
} from "@bookon/core/coaching";
import { Field, Fieldset, fieldLabel, hintText } from "@/components/form";
import { secondaryButton, textInput } from "@/components/ui";

interface Course {
  slug: string;
  name: string;
  suburb: string;
}
interface PlaceRow {
  id: number;
  courseSlug: string;
  name: string;
  suburb: string;
}
interface RateRow {
  id: number;
  rate?: CoachRate;
  /** Place row ids (or PLAYER_CHOICE) it's taught at; null is everywhere. */
  at: (number | typeof PLAYER_CHOICE)[] | null;
}

interface Choice {
  id: number | typeof PLAYER_CHOICE;
  label: string;
  /** What the form sends: the place's position, or PLAYER_CHOICE. */
  value: string;
}

const PEOPLE = { "1": "1 person", "2": "2 people", group: "Per person, in a group" };
const linkButton = "text-sm font-medium text-brand underline-offset-2 hover:underline";

export function CoachPlacesLessons({
  courses,
  places: savedPlaces,
  rates: savedRates,
  travel: savedTravel,
  suburb,
  area: savedArea,
}: {
  courses: Course[];
  places: CoachPlace[];
  rates: CoachRate[];
  travel?: CoachTravel;
  suburb: string;
  area: string;
}) {
  // Saved rows are numbered from 0 and 100 so the page matches the server's; new ones from 1000.
  const lastId = useRef(1000);
  const newId = () => ++lastId.current;
  const [area, setArea] = useState(savedArea);
  const [travels, setTravels] = useState(Boolean(savedTravel));
  const [places, setPlaces] = useState<PlaceRow[]>(() => {
    const rows = savedPlaces.map((p, i) => ({
      id: i,
      courseSlug: p.courseSlug ?? "",
      name: p.courseSlug ? "" : p.name,
      suburb: p.courseSlug ? "" : p.suburb,
    }));
    return rows.length > 0 || savedTravel ? rows : [emptyPlace(0)];
  });
  const [rates, setRates] = useState<RateRow[]>(() => {
    const keys = new Map(savedPlaces.map((p, i) => [placeKey(p), i]));
    const rows = savedRates.map((rate, i): RateRow => ({
      id: 100 + i,
      rate,
      at: rate.at
        ? rate.at.flatMap((key): Choice["id"][] => {
            if (key === PLAYER_CHOICE) return [PLAYER_CHOICE];
            const id = keys.get(key);
            return id === undefined ? [] : [id];
          })
        : null,
    }));
    return rows.length > 0 ? rows : [{ id: 100, at: null }];
  });

  // After "Add another", move to the new row's first box.
  const focusRow = useRef<string | null>(null);
  useEffect(() => {
    if (!focusRow.current) return;
    document.getElementById(focusRow.current)?.focus();
    focusRow.current = null;
  });

  const updatePlace = (id: number, change: Partial<PlaceRow>) =>
    setPlaces((rows) => rows.map((row) => (row.id === id ? { ...row, ...change } : row)));

  const placeName = (row: PlaceRow, index: number) =>
    courses.find((c) => c.slug === row.courseSlug)?.name ||
    [row.name, row.suburb].filter(Boolean).join(", ") ||
    `Place ${index + 1}`;
  // The choices a lesson can be at: places with something in them, and the golfer's choice.
  const choices: Choice[] = places
    .map((row, index) => ({ id: row.id, label: placeName(row, index), value: String(index), row }))
    .filter(({ row }) => row.courseSlug || row.name || row.suburb)
    .map(({ id, label, value }): Choice => ({ id, label, value }));
  if (travels)
    choices.push({ id: PLAYER_CHOICE, label: "At the player's choice", value: PLAYER_CHOICE });

  return (
    <>
      <Fieldset
        legend="3. Where you teach"
        hint="Pick a course or venue on BookOn, or type the name and suburb of anywhere else."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Suburb you're based in"
            name="suburb"
            required
            defaultValue={suburb}
            maxLength={60}
          />
          <div>
            <label htmlFor="f-area" className={fieldLabel}>
              Area
            </label>
            <select
              id="f-area"
              name="area"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={textInput}
            >
              <option value="" disabled>
                Choose one
              </option>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg bg-surface p-3">
          <label className="flex min-h-11 items-start gap-3 py-2">
            <input
              type="checkbox"
              name="travel"
              value="1"
              checked={travels}
              onChange={(e) => setTravels(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-brand"
            />
            <span>
              <span className="font-semibold">I&apos;m happy to travel to the player</span>
              <span className="block text-sm text-muted">
                Golfers can choose where, like their own club or home. You show up in Find a coach
                in every area you travel to.
              </span>
            </span>
          </label>
          {travels && (
            <div className="mt-2 flex flex-col gap-3 pl-8">
              <fieldset>
                <legend className={fieldLabel}>Areas you&apos;ll travel to</legend>
                <div className="flex flex-wrap gap-x-5">
                  {AREAS.map((a) => (
                    <label key={a.id} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        name="travelArea"
                        value={a.id}
                        defaultChecked={
                          savedTravel ? savedTravel.areas.includes(a.id) : a.id === area
                        }
                        className="size-5 accent-brand"
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field
                label="A note for golfers"
                name="travelNote"
                defaultValue={savedTravel?.note}
                maxLength={120}
                placeholder="Within 20 km of Joondalup"
              />
            </div>
          )}
        </div>

        {places.map((row, i) => {
          const course = courses.find((c) => c.slug === row.courseSlug);
          return (
            <div key={row.id} className="rounded-lg bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Place {i + 1}</p>
                <button
                  type="button"
                  className={linkButton}
                  onClick={() => setPlaces((rows) => rows.filter((r) => r.id !== row.id))}
                  aria-label={`Remove place ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={`f-place-${row.id}`} className={fieldLabel}>
                    On BookOn
                  </label>
                  <select
                    id={`f-place-${row.id}`}
                    name={`place${i}Course`}
                    value={row.courseSlug}
                    onChange={(e) => updatePlace(row.id, { courseSlug: e.target.value })}
                    className={textInput}
                  >
                    <option value="">Somewhere else</option>
                    {courses.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {course ? (
                  <p className="self-end pb-3 text-sm text-muted sm:col-span-2">{course.suburb}</p>
                ) : (
                  <>
                    <PlaceInput
                      label="Or its name"
                      name={`place${i}Name`}
                      id={`f-place-${row.id}-name`}
                      value={row.name}
                      maxLength={80}
                      onChange={(name) => updatePlace(row.id, { name })}
                    />
                    <PlaceInput
                      label="Suburb"
                      name={`place${i}Suburb`}
                      id={`f-place-${row.id}-suburb`}
                      value={row.suburb}
                      maxLength={60}
                      onChange={(suburb) => updatePlace(row.id, { suburb })}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
        <AddMore
          count={places.length}
          max={MAX_COACH_PLACES}
          what="place"
          onAdd={() => {
            const row = emptyPlace(newId());
            focusRow.current = `f-place-${row.id}`;
            setPlaces((rows) => [...rows, row]);
          }}
        />
        {travels && places.length === 0 && (
          <p className={hintText}>No places needed if you always go to the player.</p>
        )}
      </Fieldset>

      <Fieldset legend="4. Lessons and rates" hint="Prices include GST, as golfers pay them.">
        {rates.map((row, i) => (
          <LessonRow
            key={row.id}
            index={i}
            row={row}
            choices={choices}
            onChange={(at) =>
              setRates((rows) => rows.map((r) => (r.id === row.id ? { ...r, at } : r)))
            }
            onRemove={
              rates.length > 1
                ? () => setRates((rows) => rows.filter((r) => r.id !== row.id))
                : undefined
            }
          />
        ))}
        <AddMore
          count={rates.length}
          max={MAX_COACH_LESSONS}
          what="lesson"
          onAdd={() => {
            const row: RateRow = { id: newId(), at: null };
            focusRow.current = `f-rate-${row.id}`;
            setRates((rows) => [...rows, row]);
          }}
        />
      </Fieldset>
    </>
  );
}

function emptyPlace(id: number): PlaceRow {
  return { id, courseSlug: "", name: "", suburb: "" };
}

function PlaceInput({
  label,
  name,
  id,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  name: string;
  id: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={textInput}
      />
    </div>
  );
}

function AddMore({
  count,
  max,
  what,
  onAdd,
}: {
  count: number;
  max: number;
  what: string;
  onAdd: () => void;
}) {
  if (count >= max)
    return (
      <p className={hintText}>
        That&apos;s the most: {max} {what}s.
      </p>
    );
  return (
    <button type="button" onClick={onAdd} className={`${secondaryButton} self-start`}>
      + Add {count === 0 ? `a ${what}` : `another ${what}`}
    </button>
  );
}

function LessonRow({
  index: i,
  row,
  choices,
  onChange,
  onRemove,
}: {
  index: number;
  row: RateRow;
  choices: Choice[];
  onChange: (at: RateRow["at"]) => void;
  onRemove?: () => void;
}) {
  const rate = row.rate;
  const some = row.at !== null;
  const picked = new Set(row.at ?? []);
  return (
    <div className="grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-[2fr_1fr_1fr_1.5fr]">
      <div className="flex items-center justify-between gap-3 sm:col-span-4">
        <p className="text-sm font-semibold">Lesson {i + 1}</p>
        {onRemove && (
          <button
            type="button"
            className={linkButton}
            onClick={onRemove}
            aria-label={`Remove lesson ${i + 1}`}
          >
            Remove
          </button>
        )}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`f-rate-${row.id}`} className={fieldLabel}>
          Name
        </label>
        <input
          id={`f-rate-${row.id}`}
          name={`rate${i}Name`}
          defaultValue={rate?.name}
          placeholder={i === 0 ? "Private lesson" : undefined}
          maxLength={60}
          required
          className={textInput}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`f-rate-${row.id}-kind`} className={fieldLabel}>
          Type of lesson
        </label>
        <select
          id={`f-rate-${row.id}-kind`}
          name={`rate${i}Kind`}
          defaultValue={rate ? guessLessonKind(rate) : "private"}
          className={textInput}
        >
          {LESSON_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Minutes"
        name={`rate${i}Minutes`}
        id={`f-rate-${row.id}-minutes`}
        type="number"
        min={10}
        max={600}
        defaultValue={rate?.minutes}
        required
      />
      <Field
        label="Price $"
        name={`rate${i}Price`}
        id={`f-rate-${row.id}-price`}
        inputMode="decimal"
        defaultValue={rate ? String(rate.priceCents / 100) : ""}
        required
      />
      <div className="sm:col-span-2">
        <label htmlFor={`f-rate-${row.id}-people`} className={fieldLabel}>
          For
        </label>
        <select
          id={`f-rate-${row.id}-people`}
          name={`rate${i}People`}
          defaultValue={rate?.people ?? "1"}
          className={textInput}
        >
          {Object.entries(PEOPLE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {choices.length > 1 ? (
        <fieldset className="sm:col-span-4">
          <legend className={fieldLabel}>Where</legend>
          <input type="hidden" name={`rate${i}Where`} value={some ? "some" : "all"} />
          <div className="flex flex-wrap gap-x-5">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                checked={!some}
                onChange={() => onChange(null)}
                className="size-5 accent-brand"
              />
              Everywhere I teach
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                checked={some}
                onChange={() => onChange(choices.map((c) => c.id))}
                className="size-5 accent-brand"
              />
              Only some places
            </label>
          </div>
          {some && (
            <div className="mt-1 flex flex-col pl-7">
              {choices.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    name={`rate${i}At`}
                    value={c.value}
                    checked={picked.has(c.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...picked, c.id]
                          : [...picked].filter((id) => id !== c.id),
                      )
                    }
                    className="size-5 accent-brand"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : (
        <input type="hidden" name={`rate${i}Where`} value="all" />
      )}

      <details
        className="sm:col-span-4"
        open={Boolean(rate?.weekendCents || rate?.publicHolidayCents || rate?.schoolHolidayCents)}
      >
        <summary className="cursor-pointer text-sm font-medium text-brand">
          Different price on weekends or holidays?
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field
            label="Weekends $"
            name={`rate${i}Weekend`}
            id={`f-rate-${row.id}-weekend`}
            inputMode="decimal"
            defaultValue={rate?.weekendCents ? String(rate.weekendCents / 100) : ""}
          />
          <Field
            label="Public holidays $"
            name={`rate${i}PublicHoliday`}
            id={`f-rate-${row.id}-public-holiday`}
            inputMode="decimal"
            defaultValue={rate?.publicHolidayCents ? String(rate.publicHolidayCents / 100) : ""}
          />
          <Field
            label="School holidays $"
            name={`rate${i}SchoolHoliday`}
            id={`f-rate-${row.id}-school-holiday`}
            inputMode="decimal"
            defaultValue={rate?.schoolHolidayCents ? String(rate.schoolHolidayCents / 100) : ""}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          Leave any empty to use the price above. If a day is more than one (say, a Saturday in the
          school holidays), the public holiday price comes first, then weekend, then school holiday.
          BookOn uses WA public holidays and public school holidays.
        </p>
      </details>
    </div>
  );
}
