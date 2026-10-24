import { MATCHPLAY_MAX_ENTRIES, perthDate } from "@bookon/core";
import type { MatchplayComp } from "@bookon/db";
import { Field, TextArea, fieldLabel } from "@/components/form";
import { primaryButton, textInput } from "@/components/ui";
import { perthClock } from "@/lib/coaches";

const radio = "size-5 accent-brand";
const option = "flex min-h-11 items-center gap-2";

/** The club portal's match play form (Milestone 22), for a new competition or changes to one. */
export function CompForm({
  action,
  clubId,
  courses,
  comp,
  locked = false,
  canCharge,
}: {
  action: (formData: FormData) => Promise<void>;
  clubId: string;
  courses: { id: string; name: string }[];
  comp?: MatchplayComp;
  /** Someone has entered: the format and fee stay as they are. */
  locked?: boolean;
  /** The club has set up payments, so it can charge an entry fee. */
  canCharge: boolean;
}) {
  const dollars = (cents: number | undefined) =>
    cents ? (cents / 100).toFixed(2).replace(/\.00$/, "") : "";
  const lock = locked ? { disabled: true } : {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      {comp && <input type="hidden" name="compId" value={comp.id} />}
      {/* Disabled fields aren't sent, so send the locked values as they are. */}
      {locked && comp && (
        <>
          <input type="hidden" name="teamSize" value={comp.teamSize} />
          <input type="hidden" name="fee" value={dollars(comp.feeCents)} />
        </>
      )}
      {locked && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm">
          Players have entered, so the format and fee can&apos;t change. To change those, cancel the
          competition (anyone who paid is refunded) and set up a new one.
        </p>
      )}
      <Field
        label="Name"
        name="title"
        required
        maxLength={100}
        defaultValue={comp?.title}
        placeholder="Club Matchplay Championship"
      />
      <TextArea
        label="About the competition"
        name="description"
        maxLength={2000}
        rows={4}
        defaultValue={comp?.description}
        hint="Who can enter, tees, how to arrange matches, and prizes. BookOn doesn't use handicaps, so say how strokes work if they're given."
      />
      {courses.length > 1 ? (
        <div>
          <label htmlFor="f-courseId" className={fieldLabel}>
            Course
          </label>
          <select
            id="f-courseId"
            name="courseId"
            defaultValue={comp?.courseId}
            className={textInput}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="courseId" value={courses[0]?.id} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-teamSize" className={fieldLabel}>
            Format
          </label>
          <select
            id="f-teamSize"
            name="teamSize"
            defaultValue={String(comp?.teamSize ?? 1)}
            className={textInput}
            {...lock}
          >
            <option value="1">Singles</option>
            <option value="2">Pairs</option>
          </select>
        </div>
        <Field
          label="Field (most entries)"
          name="maxEntries"
          type="number"
          required
          min={2}
          max={MATCHPLAY_MAX_ENTRIES}
          defaultValue={comp?.maxEntries ?? 32}
          hint="If it isn't 8, 16, 32 or 64, the top seeds get byes."
        />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className={fieldLabel}>Entries</legend>
        <label className={option}>
          <input
            type="radio"
            name="onlineEntry"
            value="yes"
            defaultChecked={comp?.onlineEntry !== false}
            className={radio}
          />
          Golfers enter on BookOn (you can add entries too)
        </label>
        <label className={option}>
          <input
            type="radio"
            name="onlineEntry"
            value="no"
            defaultChecked={comp?.onlineEntry === false}
            className={radio}
          />
          You add every entry yourself
        </label>
      </fieldset>
      <Field
        label="Entry fee per player ($), for online entries"
        name="fee"
        inputMode="decimal"
        defaultValue={dollars(comp?.feeCents)}
        placeholder="0"
        hint={
          canCharge
            ? "Leave empty for free entry. Golfers pay BookOn's booking fee on top, and the fee goes to the club."
            : "Free entry only, until you set up payments (the Payments tab)."
        }
        {...(canCharge ? lock : { disabled: true })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Online entries close (day)"
          name="closeDate"
          type="date"
          defaultValue={comp?.entriesClose ? perthDate(comp.entriesClose) : undefined}
        />
        <Field
          label="Online entries close (time)"
          name="closeTime"
          type="time"
          step={300}
          defaultValue={comp?.entriesClose ? perthClock(comp.entriesClose) : "17:00"}
        />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className={fieldLabel}>Who can see it</legend>
        <label className={option}>
          <input
            type="radio"
            name="open"
            value="open"
            defaultChecked={comp?.open !== false}
            className={radio}
          />
          Open: listed on BookOn&apos;s Competitions page
        </label>
        <label className={option}>
          <input
            type="radio"
            name="open"
            value="members"
            defaultChecked={comp?.open === false}
            className={radio}
          />
          Members only: not listed, share the link with members
        </label>
      </fieldset>
      <button type="submit" className={`${primaryButton} self-start`}>
        {comp ? "Save changes" : "Set up the competition"}
      </button>
    </form>
  );
}
