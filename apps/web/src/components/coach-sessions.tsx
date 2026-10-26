import {
  GROUP_DAYS_AHEAD,
  GROUP_MAX_SPOTS,
  GROUP_MAX_WEEKS,
  addPerthDays,
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
} from "@bookon/core";
import type { CoachSession } from "@bookon/db";
import { addGroupSession, cancelGroupSessionFromPortal } from "@/app/coach/session-actions";
import { Field, TextArea, fieldLabel } from "@/components/form";
import { primaryButton, secondaryButton, textInput } from "@/components/ui";
import { SESSION_LENGTHS } from "@/lib/group-form";

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;
const box = "mt-6 rounded-xl border border-border p-4 md:p-6";

function lengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function Booked({ s }: { s: CoachSession }) {
  const paid = s.bookings.reduce((n, b) => n + b.spots, 0);
  return (
    <p className="text-sm">
      <strong>
        {paid} of {s.spots} booked
      </strong>
      {s.minSpots &&
        !s.goingAheadAt &&
        s.status === "open" &&
        ` · needs ${s.minSpots} by 24 hours before, or it's called off`}
      {s.goingAheadAt && s.status === "open" && " · going ahead"}
    </p>
  );
}

function Status({ s }: { s: CoachSession }) {
  if (s.status !== "cancelled") return null;
  return (
    <p className="text-sm font-medium text-warning-fg">
      {s.cancelledBy === "minimum" ? "Called off (not enough booked)" : "You cancelled this"}.
      Everyone was refunded.
    </p>
  );
}

/** Group sessions in My coaching (Milestone 19): put one on, see who's coming, call one off. */
export function CoachSessions({
  sessions,
  places,
  canAdd,
  now,
}: {
  sessions: CoachSession[];
  /** The coach's teaching places, as labels. */
  places: string[];
  /** Bookings are on, so golfers can pay for spots. */
  canAdd: boolean;
  now: Date;
}) {
  const upcoming = sessions.filter((s) => s.endTime > now);
  const past = sessions.filter((s) => s.endTime <= now && s.status === "open").reverse();
  const today = perthDate(now);

  return (
    <section id="sessions" className={box} aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="text-lg font-semibold">
        Group sessions
      </h2>
      <p className="mt-1 text-sm text-muted">
        Clinics, squads and group lessons. Golfers buy spots on your page and are charged straight
        away, with one booking fee per booking.
      </p>

      {upcoming.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {upcoming.map((s) => (
            <li
              key={s.id}
              className={`rounded-lg border p-3 ${s.status === "cancelled" ? "border-border opacity-70" : "border-border"}`}
            >
              <p className="font-semibold">
                {s.title} · {when(s.startTime)}
              </p>
              <p className="text-sm text-muted">
                {lengthLabel((s.endTime.getTime() - s.startTime.getTime()) / 60_000)} · {s.place} ·{" "}
                {formatPrice(s.priceCents)} a spot
              </p>
              <Booked s={s} />
              <Status s={s} />
              {s.bookings.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {s.bookings.map((b) => (
                    <li key={b.id} className="border-t border-border pt-1 first:border-t-0">
                      <span className="font-medium">{b.golferName}</span>
                      {b.spots > 1 && ` (${b.spots} spots)`} ·{" "}
                      <a href={`tel:${b.golferPhone}`} className="text-brand">
                        {formatAuPhone(b.golferPhone)}
                      </a>{" "}
                      ·{" "}
                      <a href={`mailto:${b.golferEmail}`} className="text-brand">
                        {b.golferEmail}
                      </a>
                      {b.note && <span className="block text-muted">&ldquo;{b.note}&rdquo;</span>}
                    </li>
                  ))}
                </ul>
              )}
              {s.status === "open" && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-brand">
                    Need to call it off?
                  </summary>
                  <form
                    action={cancelGroupSessionFromPortal}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <label className="sr-only" htmlFor={`cancel-${s.id}`}>
                      Note to golfers
                    </label>
                    <input
                      id={`cancel-${s.id}`}
                      name="note"
                      maxLength={300}
                      placeholder="Sorry, … (optional)"
                      className={`${textInput} min-h-11 w-56`}
                    />
                    <button type="submit" className={secondaryButton}>
                      {s.bookings.length > 0 ? "Cancel and refund everyone" : "Cancel this session"}
                    </button>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mt-5 font-semibold">Earlier</h3>
          <ul className="mt-2 text-sm">
            {past.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-3 border-t border-border py-2 first:border-t-0"
              >
                <span>
                  {s.title} · {when(s.startTime)}
                </span>
                <span className="text-muted">
                  {s.bookings.reduce((n, b) => n + b.spots, 0)} came
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {canAdd ? (
        <details className="mt-5" open={upcoming.length === 0}>
          <summary className="cursor-pointer font-semibold text-brand">Put on a session</summary>
          <form action={addGroupSession} className="mt-3 flex flex-col gap-4">
            <Field
              label="Name"
              name="title"
              required
              maxLength={80}
              placeholder="Beginners' clinic"
            />
            <TextArea
              label="What it covers"
              name="details"
              maxLength={500}
              hint="For example who it suits, what to bring, or the age range for juniors."
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First date"
                name="date"
                type="date"
                required
                min={today}
                max={addPerthDays(today, GROUP_DAYS_AHEAD)}
              />
              <Field label="Starts" name="time" type="time" required step={900} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="f-minutes" className={fieldLabel}>
                  How long
                </label>
                <select id="f-minutes" name="minutes" defaultValue="60" className={textInput}>
                  {SESSION_LENGTHS.map((m) => (
                    <option key={m} value={m}>
                      {lengthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-weeks" className={fieldLabel}>
                  Repeat
                </label>
                <select id="f-weeks" name="weeks" defaultValue="1" className={textInput}>
                  <option value="1">Just once</option>
                  {Array.from({ length: GROUP_MAX_WEEKS - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      Weekly, {n} weeks
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {places.length > 1 ? (
              <div>
                <label htmlFor="f-place" className={fieldLabel}>
                  Where
                </label>
                <select id="f-place" name="place" required className={textInput}>
                  {places.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            ) : places.length === 1 ? (
              <input type="hidden" name="place" value={places[0]} />
            ) : (
              <Field
                label="Where"
                name="place"
                required
                maxLength={100}
                hint="The course, park or venue, and its suburb."
              />
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Price a spot ($)"
                name="price"
                required
                inputMode="decimal"
                placeholder="40"
              />
              <Field
                label="Spots"
                name="spots"
                type="number"
                required
                min={2}
                max={GROUP_MAX_SPOTS}
                defaultValue={8}
              />
              <Field label="Minimum" name="minSpots" type="number" min={2} max={GROUP_MAX_SPOTS} />
            </div>
            <p className="-mt-2 text-sm text-muted">
              With a minimum, if fewer have booked 24 hours before, the session is called off and
              everyone is refunded automatically. We email you either way.
            </p>
            <button type="submit" className={`${primaryButton} self-start`}>
              Add to my page
            </button>
          </form>
        </details>
      ) : (
        <p className="mt-4 text-sm text-muted">
          To put on group sessions golfers can pay for, turn on bookings through BookOn and agree to
          the payment terms (above).
        </p>
      )}
    </section>
  );
}
