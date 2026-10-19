import Link from "next/link";
import {
  formatAuPhone,
  formatPerthDay,
  formatPerthTime,
  formatPrice,
  perthDate,
} from "@bookon/core";
import {
  LESSON_PAYMENT_TERMS,
  acceptedLessonPaymentTerms,
  type Coach,
  type LessonBooking,
} from "@bookon/db";
import {
  acceptLessonFromPortal,
  cancelLessonFromPortal,
  declineLessonFromPortal,
  openStripeDashboard,
  setUpCoachPayments,
  turnBookingsOff,
  turnBookingsOn,
} from "@/app/coach/lesson-actions";
import { Checkbox } from "@/components/form";
import { primaryButton, secondaryButton, textInput } from "@/components/ui";

const when = (d: Date) => `${formatPerthDay(perthDate(d))}, ${formatPerthTime(d)}`;
const box = "mt-6 rounded-xl border border-border p-4 md:p-6";

const PAST: Record<LessonBooking["status"], string> = {
  checkout: "Not paid",
  requested: "Waiting",
  confirmed: "Taught",
  declined: "You declined",
  lapsed: "Lapsed (no answer)",
  cancelled: "Cancelled",
  abandoned: "Not paid",
};

function Golfer({ b }: { b: LessonBooking }) {
  return (
    <>
      <p className="font-semibold">
        {b.golferName} · {when(b.startTime)}
      </p>
      <p className="text-sm text-muted">
        {b.rate.name}, {b.rate.minutes} min · {b.place} · you&apos;re paid{" "}
        {formatPrice(b.lessonCents)}
      </p>
      <p className="mt-1 text-sm">
        <a href={`tel:${b.golferPhone}`} className="text-brand">
          {formatAuPhone(b.golferPhone)}
        </a>{" "}
        ·{" "}
        <a href={`mailto:${b.golferEmail}`} className="text-brand">
          {b.golferEmail}
        </a>
      </p>
      {b.note && <p className="mt-1 text-sm">&ldquo;{b.note}&rdquo;</p>}
    </>
  );
}

/** Payments with Stripe, and the lessons golfers have booked (Milestone 15). */
export function CoachLessons({
  coach,
  lessons,
  provider,
  enabled,
  feeCents,
  now,
}: {
  coach: Coach;
  lessons: { requests: LessonBooking[]; upcoming: LessonBooking[]; past: LessonBooking[] };
  /** Null when payments aren't available on this site. */
  provider: "stripe" | "practice" | null;
  enabled: boolean;
  feeCents: number;
  now: Date;
}) {
  const terms = acceptedLessonPaymentTerms(coach.consents);
  const requests = lessons.requests.filter((b) => !b.respondBy || b.respondBy > now);

  return (
    <>
      {(requests.length > 0 || lessons.upcoming.length > 0 || lessons.past.length > 0) && (
        <section id="lessons" className={box} aria-labelledby="lessons-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="lessons-heading" className="text-lg font-semibold">
              Lessons booked through BookOn
            </h2>
            <Link href="/coach/calendar" className="font-medium text-brand">
              See them in your calendar
            </Link>
          </div>
          {requests.length > 0 && (
            <>
              <h3 className="mt-4 font-semibold">Waiting for you ({requests.length})</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {requests.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-warning-border bg-warning-bg/40 p-3"
                  >
                    <Golfer b={b} />
                    <p className="mt-1 text-sm text-muted">
                      Answer by {when(b.respondBy!)}. The golfer&apos;s card is held until then.
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <form action={acceptLessonFromPortal}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className={primaryButton}>
                          Accept and charge {formatPrice(b.lessonCents + b.feeCents)}
                        </button>
                      </form>
                      <form
                        action={declineLessonFromPortal}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <label className="sr-only" htmlFor={`note-${b.id}`}>
                          Note to the golfer
                        </label>
                        <input
                          id={`note-${b.id}`}
                          name="note"
                          maxLength={300}
                          placeholder="Note to the golfer (optional)"
                          className={`${textInput} min-h-11 w-56`}
                        />
                        <button type="submit" className={secondaryButton}>
                          Decline
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {lessons.upcoming.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Coming up</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {lessons.upcoming.map((b) => (
                  <li key={b.id} className="rounded-lg border border-border p-3">
                    <Golfer b={b} />
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-brand">
                        Can&apos;t make it?
                      </summary>
                      <form
                        action={cancelLessonFromPortal}
                        className="mt-2 flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <label className="sr-only" htmlFor={`cancel-${b.id}`}>
                          Note to the golfer
                        </label>
                        <input
                          id={`cancel-${b.id}`}
                          name="note"
                          maxLength={300}
                          placeholder="Sorry, … (optional)"
                          className={`${textInput} min-h-11 w-56`}
                        />
                        <button type="submit" className={secondaryButton}>
                          Cancel and refund {formatPrice(b.lessonCents + b.feeCents)}
                        </button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
          {lessons.past.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Earlier</h3>
              <ul className="mt-2 text-sm">
                {lessons.past.map((b) => (
                  <li
                    key={b.id}
                    className="flex justify-between gap-3 border-t border-border py-2 first:border-t-0"
                  >
                    <span>
                      {b.golferName} · {when(b.startTime)}
                    </span>
                    <span className="text-muted">
                      {b.status === "cancelled" &&
                      b.cancelledBy === "golfer" &&
                      b.refundCents === 0 &&
                      b.decidedAt
                        ? "Late cancel (paid)"
                        : PAST[b.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section id="payments" className={box} aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-lg font-semibold">
          Bookings and payments
        </h2>
        {!provider || !enabled ? (
          <p className="mt-2 text-sm text-muted">
            Booking and paying through BookOn isn&apos;t available right now. Golfers contact you
            directly.
          </p>
        ) : coach.paymentsReady && coach.paymentAccountId ? (
          <>
            <p className="mt-2">
              {coach.takesBookings ? (
                <>
                  <strong>Golfers can book and pay for lessons on your page.</strong> You accept or
                  decline each request within 48 hours.
                </>
              ) : (
                <>Payments are set up. Turn bookings on so golfers can book and pay on your page.</>
              )}
            </p>
            <p className="mt-2 text-sm text-muted">
              You get your full lesson price; golfers pay a {formatPrice(feeCents)} booking fee on
              top. Stripe pays you, usually two business days after you accept.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {coach.takesBookings ? (
                <form action={turnBookingsOff}>
                  <button type="submit" className={secondaryButton}>
                    Turn bookings off
                  </button>
                </form>
              ) : (
                <form action={turnBookingsOn}>
                  <button type="submit" className={primaryButton}>
                    Turn bookings on
                  </button>
                </form>
              )}
              <form action={openStripeDashboard}>
                <button type="submit" className={secondaryButton}>
                  Payouts and receipts (Stripe)
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={setUpCoachPayments} className="mt-2 flex flex-col gap-3">
            <p>
              Let golfers book a time and pay on your BookOn page. Their card is held until you
              accept, and you keep your full lesson price.
            </p>
            <p className="text-sm text-muted">
              {coach.paymentAccountId
                ? "You've started setting up with Stripe. Finish it to turn bookings on."
                : "Stripe, who handle payments for BookOn, will ask for your name, ABN (if you have one), ID and bank account. It takes about 5 minutes. BookOn never sees your bank details."}
            </p>
            {!terms && (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p>{LESSON_PAYMENT_TERMS}</p>
                <Checkbox name="terms" value="yes">
                  I agree
                </Checkbox>
                <label htmlFor="terms-by" className="mb-1.5 block font-medium">
                  Your name
                </label>
                <input id="terms-by" name="termsBy" maxLength={80} className={textInput} />
              </div>
            )}
            <button type="submit" className={`${primaryButton} self-start`}>
              {coach.paymentAccountId
                ? "Finish setting up with Stripe"
                : "Set up payments with Stripe"}
            </button>
            {provider === "practice" && (
              <p className="text-sm text-muted">
                Practice mode: no Stripe account is made on this computer.
              </p>
            )}
          </form>
        )}
      </section>
    </>
  );
}
