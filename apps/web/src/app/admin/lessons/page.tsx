import Link from "next/link";
import { formatPerthDay, formatPerthTime, formatPrice, perthDate } from "@bookon/core";
import {
  groupBookingTotalCents,
  lessonPaymentSettings,
  lessonTotalCents,
  listGroupBookingsForAdmin,
  listLessonsForAdmin,
  type GroupBooking,
  type LessonBooking,
} from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonPayments } from "@/lib/lessons";

const STATUS: Record<LessonBooking["status"], { label: string; tone: "good" | "warn" | "muted" }> =
  {
    checkout: { label: "At checkout", tone: "muted" },
    requested: { label: "Waiting for coach", tone: "warn" },
    confirmed: { label: "Booked", tone: "good" },
    declined: { label: "Declined", tone: "muted" },
    lapsed: { label: "Lapsed", tone: "muted" },
    cancelled: { label: "Cancelled", tone: "muted" },
    abandoned: { label: "Not paid", tone: "muted" },
  };

const GROUP_STATUS: Record<GroupBooking["status"], string> = {
  checkout: "At checkout",
  paid: "Paid",
  cancelled: "Cancelled",
  abandoned: "Not paid",
};
const CANCELLED_BY: Record<string, string> = {
  golfer: "Cancelled by golfer",
  coach: "Cancelled by coach",
  minimum: "Called off (minimum)",
};

const when = (d: Date) => `${formatPerthDay(perthDate(d))} ${formatPerthTime(d)}`;

/** Every lesson golfers paid for (Milestone 15), and group spots (Milestone 19), newest first. */
export default async function AdminLessons() {
  await requireAdmin();
  const db = getDb();
  const rows = await listLessonsForAdmin(db);
  const groups = await listGroupBookingsForAdmin(db);
  const settings = await lessonPaymentSettings(db);
  const provider = await lessonPayments();
  return (
    <>
      <PageTitle
        title="Lessons"
        intro="Lessons golfers booked and paid for through BookOn, newest first. Money moves in Stripe; refunds and payouts show in the Stripe dashboard."
      />
      <div className="mb-4 flex flex-col gap-2">
        {!provider && (
          <Notice tone="warning">
            Payments are off: STRIPE_SECRET_KEY isn&apos;t set on this site.
          </Notice>
        )}
        {provider?.kind === "practice" && (
          <Notice tone="info">Practice payments: no money moves on this computer.</Notice>
        )}
        {!settings.enabled && (
          <Notice tone="warning">
            Lesson payments are turned off in{" "}
            <Link href="/admin/settings" className="underline">
              Settings
            </Link>
            .
          </Notice>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">No lessons booked yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Lesson</th>
                <th className={thClass}>Coach</th>
                <th className={thClass}>Golfer</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Paid</th>
                <th className={`${thClass} text-right`}>Fee</th>
                <th className={`${thClass} text-right`}>Refunded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking: b, coachName }) => (
                <tr key={b.id}>
                  <td className={tdClass}>
                    {when(b.startTime)}
                    <span className="block text-muted">
                      {b.rate.name}, {b.rate.minutes} min
                    </span>
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/coaches/${b.coachId}`} className="text-brand">
                      {coachName}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {b.golferName}
                    <span className="block text-muted">{b.golferEmail}</span>
                  </td>
                  <td className={tdClass}>
                    <Pill tone={STATUS[b.status].tone}>
                      {b.status === "cancelled" && b.cancelledBy === "coach"
                        ? "Cancelled by coach"
                        : STATUS[b.status].label}
                    </Pill>
                    {b.provider === "practice" && (
                      <span className="mt-1 block text-xs text-muted">Practice</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatPrice(lessonTotalCents(b))}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatPrice(b.feeCents)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {b.refundCents ? formatPrice(b.refundCents) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 mt-10 text-xl font-semibold">Group sessions</h2>
      {groups.length === 0 ? (
        <p className="text-muted">No group spots booked yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Session</th>
                <th className={thClass}>Coach</th>
                <th className={thClass}>Golfer</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Paid</th>
                <th className={`${thClass} text-right`}>Fee</th>
                <th className={`${thClass} text-right`}>Refunded</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ booking: b, session, coachName }) => (
                <tr key={b.id}>
                  <td className={tdClass}>
                    {when(session.startTime)}
                    <span className="block text-muted">{session.title}</span>
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/coaches/${session.coachId}`} className="text-brand">
                      {coachName}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {b.golferName} ({b.spots} {b.spots === 1 ? "spot" : "spots"})
                    <span className="block text-muted">{b.golferEmail}</span>
                  </td>
                  <td className={tdClass}>
                    <Pill tone={b.status === "paid" ? "good" : "muted"}>
                      {b.status === "cancelled" && b.cancelledBy
                        ? CANCELLED_BY[b.cancelledBy]
                        : GROUP_STATUS[b.status]}
                    </Pill>
                    {b.provider === "practice" && (
                      <span className="mt-1 block text-xs text-muted">Practice</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatPrice(groupBookingTotalCents(b))}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatPrice(b.feeCents)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {b.refundCents ? formatPrice(b.refundCents) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
