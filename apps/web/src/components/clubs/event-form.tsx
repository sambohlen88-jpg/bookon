import { EVENT_INTERVALS, TEAM_NAME, TEAM_SIZES, perthDate, type TeamSize } from "@bookon/core";
import type { ClubEvent } from "@bookon/db";
import { Field, TextArea, fieldLabel } from "@/components/form";
import { primaryButton, textInput } from "@/components/ui";
import { perthClock } from "@/lib/coaches";

const radio = "size-5 accent-brand";
const option = "flex min-h-11 items-center gap-2";

/** The club portal's event form (Milestone 21), for a new event or changes to one. */
export function EventForm({
  action,
  clubId,
  courses,
  event,
  locked = false,
  today,
}: {
  action: (formData: FormData) => Promise<void>;
  clubId: string;
  courses: { id: string; name: string }[];
  event?: ClubEvent;
  /** Golfers have entered: only some details can change. */
  locked?: boolean;
  today: string;
}) {
  const dollars = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(/\.00$/, "");
  const lock = locked ? { disabled: true } : {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      {/* Disabled fields aren't sent, so send the locked values as they are. */}
      {locked && event && (
        <>
          <input type="hidden" name="courseId" value={event.courseId} />
          <input type="hidden" name="date" value={event.date} />
          <input type="hidden" name="holes" value={event.holes} />
          <input type="hidden" name="startType" value={event.startType} />
          <input type="hidden" name="time" value={perthClock(event.firstStart)} />
          <input type="hidden" name="interval" value={event.intervalMinutes} />
          {event.twoTees && <input type="hidden" name="twoTees" value="yes" />}
          <input type="hidden" name="teamSize" value={event.teamSize} />
          <input type="hidden" name="fee" value={dollars(event.feeCents)} />
          <input type="hidden" name="memberFee" value={dollars(event.memberFeeCents)} />
        </>
      )}
      {locked && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm">
          Golfers have entered, so the day, start, format and fees can&apos;t change. To change
          those, cancel the event (everyone is refunded) and put on a new one.
        </p>
      )}
      <Field
        label="Name"
        name="title"
        required
        maxLength={100}
        defaultValue={event?.title}
        placeholder="Saturday Ambrose"
      />
      <TextArea
        label="About the event"
        name="description"
        maxLength={2000}
        rows={4}
        defaultValue={event?.description}
        hint="Format, prizes, dress, what's included (like a meal or cart), and anything to bring."
      />
      {courses.length > 1 ? (
        <div>
          <label htmlFor="f-courseId" className={fieldLabel}>
            Course
          </label>
          <select
            id="f-courseId"
            name="courseId"
            defaultValue={event?.courseId}
            className={textInput}
            {...lock}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        !locked && <input type="hidden" name="courseId" value={courses[0]?.id} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Day"
          name="date"
          type="date"
          required
          min={today}
          defaultValue={event?.date}
          {...lock}
        />
        <div>
          <label htmlFor="f-holes" className={fieldLabel}>
            Holes
          </label>
          <select
            id="f-holes"
            name="holes"
            defaultValue={String(event?.holes ?? 18)}
            className={textInput}
            {...lock}
          >
            <option value="18">18 holes</option>
            <option value="9">9 holes</option>
          </select>
        </div>
      </div>
      <fieldset className="flex flex-col gap-3" {...lock}>
        <legend className={fieldLabel}>Start</legend>
        <div className="flex flex-wrap gap-x-6">
          <label className={option}>
            <input
              type="radio"
              name="startType"
              value="tees"
              defaultChecked={event?.startType !== "shotgun"}
              className={radio}
            />
            Tee times
          </label>
          <label className={option}>
            <input
              type="radio"
              name="startType"
              value="shotgun"
              defaultChecked={event?.startType === "shotgun"}
              className={radio}
            />
            Shotgun (everyone starts at once)
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First start, or shotgun time"
            name="time"
            type="time"
            required
            step={300}
            defaultValue={event ? perthClock(event.firstStart) : "07:00"}
          />
          <div>
            <label htmlFor="f-interval" className={fieldLabel}>
              Time between groups
            </label>
            <select
              id="f-interval"
              name="interval"
              defaultValue={String(event?.intervalMinutes ?? 10)}
              className={textInput}
            >
              {EVENT_INTERVALS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className={option}>
          <input
            type="checkbox"
            name="twoTees"
            value="yes"
            defaultChecked={event?.twoTees}
            className={radio}
          />
          Tee times off the 1st and 10th at once
        </label>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-teamSize" className={fieldLabel}>
            Format
          </label>
          <select
            id="f-teamSize"
            name="teamSize"
            defaultValue={String(event?.teamSize ?? 1)}
            className={textInput}
            {...lock}
          >
            {TEAM_SIZES.map((n) => (
              <option key={n} value={n}>
                {TEAM_NAME[n as TeamSize]}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Field (most players)"
          name="maxPlayers"
          type="number"
          required
          min={2}
          max={240}
          defaultValue={event?.maxPlayers ?? 72}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Entry fee per player ($)"
          name="fee"
          required
          inputMode="decimal"
          defaultValue={dollars(event?.feeCents)}
          placeholder="45"
          {...lock}
        />
        <Field
          label="Members' fee per player ($)"
          name="memberFee"
          inputMode="decimal"
          defaultValue={dollars(event?.memberFeeCents)}
          hint="Players who give a member number pay this. You check the numbers."
          {...lock}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Entries close (day)"
          name="closeDate"
          type="date"
          required
          defaultValue={event ? perthDate(event.entriesClose) : undefined}
        />
        <Field
          label="Entries close (time)"
          name="closeTime"
          type="time"
          required
          step={300}
          defaultValue={event ? perthClock(event.entriesClose) : "17:00"}
        />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className={fieldLabel}>Who can enter</legend>
        <label className={option}>
          <input
            type="radio"
            name="open"
            value="open"
            defaultChecked={event?.open !== false}
            className={radio}
          />
          Open: anyone, listed on BookOn&apos;s Competitions page
        </label>
        <label className={option}>
          <input
            type="radio"
            name="open"
            value="members"
            defaultChecked={event?.open === false}
            className={radio}
          />
          Members only: not listed, share the link with members. Each player gives a member number.
        </label>
      </fieldset>
      <button type="submit" className={`${primaryButton} self-start`}>
        {event ? "Save changes" : "Put on this event"}
      </button>
    </form>
  );
}
