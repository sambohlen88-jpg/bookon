import { bookingFunnels } from "@bookon/db";
import { AnalyticsFrame, Section } from "@/components/analytics/frame";
import { BarList, Funnel } from "@/components/analytics/charts";
import { panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { rangeFromQuery } from "@/lib/analytics-view";
import { getDb } from "@/lib/db";

const CONTACT: Record<string, string> = {
  phone: "Phoned",
  email: "Emailed",
  whatsapp: "Messaged on WhatsApp",
  website: "Opened their website",
};

/** Analytics, coaching and events (Milestone 23): from looking to booking or entering. */
export default async function AnalyticsBookings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/analytics/bookings");
  const range = rangeFromQuery(await searchParams);
  const f = await bookingFunnels(getDb(), range);
  return (
    <AnalyticsFrame tab="bookings" range={range}>
      <p className="mb-6 text-sm text-muted">
        Page steps count people; the paying steps count bookings and entries. Where a step drops off
        sharply is worth a look.
      </p>
      <div className="mb-8 grid gap-8 md:grid-cols-2">
        <div className={panel}>
          <Funnel title="Lessons" steps={f.lessons} />
        </div>
        <div className={panel}>
          <Funnel title="Group sessions" steps={f.groups} />
          <div className="mt-8">
            <BarList
              title="Golfers contacting coaches directly"
              empty="No direct contacts in these dates."
              rows={f.coachContacts.map((c) => ({
                label: CONTACT[c.label] ?? c.label,
                value: c.count,
              }))}
            />
          </div>
        </div>
      </div>
      <Section title="Club competitions">
        <div className="grid gap-8 md:grid-cols-2">
          <div className={panel}>
            <Funnel title="Events" steps={f.events} />
          </div>
          <div className={panel}>
            <Funnel title="Match play" steps={f.matchplay} />
          </div>
        </div>
      </Section>
    </AnalyticsFrame>
  );
}
