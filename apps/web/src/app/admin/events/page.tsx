import Link from "next/link";
import { formatPerthDay, formatPerthTime, formatPrice } from "@bookon/core";
import { eventPaymentSettings, listClubs, listEventsForAdmin } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Club events (Milestone 21): every event in the last six months and ahead, and clubs' payments. */
export default async function AdminEvents() {
  await requireAdmin();
  const db = getDb();
  const now = new Date();
  const events = await listEventsForAdmin(db, now);
  const settings = await eventPaymentSettings(db);
  const clubs = (await listClubs(db)).filter((c) => c.paymentAccountId);
  return (
    <>
      <PageTitle
        title="Events"
        intro="Club competitions and social days golfers enter on BookOn. Money moves in Stripe, straight to each club."
      />
      {!settings.enabled && (
        <div className="mb-4">
          <Notice tone="warning">
            Event payments are turned off in{" "}
            <Link href="/admin/settings#event-payments" className="underline">
              Settings
            </Link>
            .
          </Notice>
        </div>
      )}
      <h2 className="mb-3 text-xl font-semibold">Clubs taking payments</h2>
      {clubs.length === 0 ? (
        <p className="mb-8 text-muted">No club has started setting up payments yet.</p>
      ) : (
        <ul className="mb-8 flex flex-wrap gap-2">
          {clubs.map((c) => (
            <li key={c.id}>
              <Pill tone={c.paymentsReady ? "good" : "warn"}>
                {c.name}: {c.paymentsReady ? "ready" : "setting up"}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mb-3 text-xl font-semibold">Events</h2>
      {events.length === 0 ? (
        <p className="text-muted">No events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Event</th>
                <th className={thClass}>Club</th>
                <th className={thClass}>Day</th>
                <th className={`${thClass} text-right`}>Entered</th>
                <th className={`${thClass} text-right`}>Fee</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className={tdClass}>
                    <Link href={`/competitions/${e.id}`} className="text-brand">
                      {e.title}
                    </Link>
                    {!e.open && <span className="block text-muted">Members only</span>}
                  </td>
                  <td className={tdClass}>
                    <Link href={`/club/${e.clubId}/events/${e.id}`} className="text-brand">
                      {e.clubName}
                    </Link>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatPerthDay(e.date)}, {formatPerthTime(e.firstStart)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {e.taken} of {e.maxPlayers}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatPrice(e.feeCents)}
                  </td>
                  <td className={tdClass}>
                    {e.status === "cancelled" ? (
                      <Pill tone="muted">Cancelled</Pill>
                    ) : e.firstStart <= now ? (
                      <Pill tone="muted">Played</Pill>
                    ) : e.entriesClose <= now ? (
                      <Pill tone="warn">Entries closed</Pill>
                    ) : (
                      <Pill tone="good">Open</Pill>
                    )}
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
