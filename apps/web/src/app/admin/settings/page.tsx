import { formatPrice, formatPublicHolidays, formatSchoolHolidays } from "@bookon/core";
import {
  SOCIAL_NETWORKS,
  analyticsSettings,
  businessDetails,
  eventPaymentSettings,
  lessonPaymentSettings,
  pitchContact,
  socialLinks,
  waCalendar,
} from "@bookon/db";
import { saveSocialLinks } from "@/app/admin/coach-actions";
import {
  saveBookingFee,
  turnLessonPaymentsOff,
  turnLessonPaymentsOn,
} from "@/app/admin/lesson-actions";
import {
  saveEventBookingFee,
  turnEventPaymentsOff,
  turnEventPaymentsOn,
} from "@/app/admin/event-actions";
import {
  saveBusinessDetails,
  savePitchContact,
  saveWaCalendar,
  turnWeeklySummaryOff,
  turnWeeklySummaryOn,
} from "@/app/admin/settings-actions";
import { PageTitle, panel } from "@/components/admin/ui";
import { Field, TextArea } from "@/components/form";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

const NAMES = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" } as const;

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const links = await socialLinks(getDb());
  const contact = await pitchContact(getDb());
  const lessons = await lessonPaymentSettings(getDb());
  const holidays = await waCalendar(getDb());
  const events = await eventPaymentSettings(getDb());
  const analytics = await analyticsSettings(getDb());
  const business = await businessDetails(getDb());
  const query = await searchParams;
  const { saved, error } = query;
  const bad = query.bad?.split("\n") ?? [];
  return (
    <>
      <PageTitle title="Settings" />
      {saved && (
        <div className="mb-4">
          <Notice tone="info">Saved.</Notice>
        </div>
      )}
      {error === "fee" && (
        <div className="mb-4">
          <Notice tone="warning">Enter a fee between $0 and $50, like 2.50.</Notice>
        </div>
      )}
      {error === "abn" && (
        <div className="mb-4">
          <Notice tone="warning">That ABN doesn&apos;t look right. Check the 11 digits.</Notice>
        </div>
      )}
      {error === "email" && (
        <div className="mb-4">
          <Notice tone="warning">Check the email address.</Notice>
        </div>
      )}
      <section id="lesson-payments" className={`${panel} mb-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">Lesson payments</h2>
        <p className="text-sm text-muted">
          {lessons.enabled
            ? "On: golfers can book and pay for lessons with coaches who've set up Stripe."
            : "Off: nobody can book and pay for lessons. Golfers contact coaches directly, and booked lessons carry on."}
        </p>
        <form action={lessons.enabled ? turnLessonPaymentsOff : turnLessonPaymentsOn}>
          <button type="submit" className={lessons.enabled ? secondaryButton : primaryButton}>
            {lessons.enabled ? "Turn lesson payments off" : "Turn lesson payments on"}
          </button>
        </form>
        <form action={saveBookingFee} className="flex flex-col gap-4">
          <Field
            label="Booking fee golfers pay per lesson"
            name="fee"
            required
            inputMode="decimal"
            defaultValue={(lessons.feeCents / 100).toFixed(2)}
            hint={`Now ${formatPrice(lessons.feeCents)}. Stripe's card fee (roughly 1.7% + 30c of the total) comes out of this, so on a $90 lesson about $1.87 goes to Stripe. New bookings only.`}
          />
          <button type="submit" className={primaryButton}>
            Save fee
          </button>
        </form>
      </section>
      <section id="event-payments" className={`${panel} mb-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">Club event payments</h2>
        <p className="text-sm text-muted">
          {events.enabled
            ? "On: golfers can enter and pay for events at clubs that have set up Stripe."
            : "Off: nobody can enter events through BookOn. Entries already paid carry on."}
        </p>
        <form action={events.enabled ? turnEventPaymentsOff : turnEventPaymentsOn}>
          <button type="submit" className={events.enabled ? secondaryButton : primaryButton}>
            {events.enabled ? "Turn event payments off" : "Turn event payments on"}
          </button>
        </form>
        <form action={saveEventBookingFee} className="flex flex-col gap-4">
          <Field
            label="Booking fee golfers pay per entry"
            name="fee"
            required
            inputMode="decimal"
            defaultValue={(events.feeCents / 100).toFixed(2)}
            hint={`Now ${formatPrice(events.feeCents)}, once per entry (a team pays it once). Stripe's card fee comes out of this. New entries only.`}
          />
          <button type="submit" className={primaryButton}>
            Save fee
          </button>
        </form>
      </section>
      <form
        id="business"
        action={saveBusinessDetails}
        className={`${panel} mb-6 flex flex-col gap-4 scroll-mt-4`}
      >
        <h2 className="text-lg font-semibold">Business details</h2>
        <p className="text-sm text-muted">
          Shown in the{" "}
          <a href="/privacy" className="text-brand underline">
            privacy policy
          </a>{" "}
          and{" "}
          <a href="/terms" className="text-brand underline">
            terms of use
          </a>{" "}
          as who runs BookOn. Until they&apos;re set, those pages just say &ldquo;BookOn&rdquo;.
        </p>
        <Field
          label="Business or company name"
          name="name"
          maxLength={120}
          defaultValue={business.name}
          placeholder="BookOn Pty Ltd"
        />
        <Field
          label="ABN"
          name="abn"
          inputMode="numeric"
          maxLength={14}
          defaultValue={business.abn}
          placeholder="51 824 753 556"
        />
        <button type="submit" className={`${primaryButton} self-start`}>
          Save
        </button>
      </form>
      <section id="analytics" className={`${panel} mb-6 flex flex-col gap-4 scroll-mt-4`}>
        <h2 className="text-lg font-semibold">Analytics summary email</h2>
        <p className="text-sm text-muted">
          {analytics.weeklyEmail
            ? "On: every Monday morning you're emailed last week's visitors, searches, clicks to clubs and top courses."
            : "Off: no Monday summary. Analytics is still in Admin, Analytics."}{" "}
          It goes to the admin email the worker is given (BOOKON_ADMIN_EMAIL).
        </p>
        <form action={analytics.weeklyEmail ? turnWeeklySummaryOff : turnWeeklySummaryOn}>
          <button type="submit" className={analytics.weeklyEmail ? secondaryButton : primaryButton}>
            {analytics.weeklyEmail ? "Turn the Monday email off" : "Turn the Monday email on"}
          </button>
        </form>
      </section>
      <form id="holidays" action={saveWaCalendar} className={`${panel} mb-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">WA holiday dates</h2>
        <p className="text-sm text-muted">
          Used for coaches&apos; public holiday and school holiday prices. Add new years when WA
          announces them. One per line, dates as year-month-day.
        </p>
        {error === "holidays" && (
          <Notice tone="warning">
            Nothing saved. These lines need fixing:{" "}
            {bad.map((b) => `"${b}"`).join(", ") || "check the dates"}.
          </Notice>
        )}
        <TextArea
          label="Public holidays"
          name="publicHolidays"
          required
          rows={10}
          maxLength={6000}
          defaultValue={formatPublicHolidays(holidays.publicHolidays)}
          hint="Like: 2028-01-26 Australia Day"
        />
        <TextArea
          label="School holidays"
          name="schoolHolidays"
          required
          rows={8}
          maxLength={4000}
          defaultValue={formatSchoolHolidays(holidays.schoolHolidays)}
          hint="Like: 2028-04-08 to 2028-04-23 Easter school holidays. Include the weekends either side."
        />
        <button type="submit" className={primaryButton}>
          Save holiday dates
        </button>
      </form>
      <form action={savePitchContact} className={`${panel} mb-6 flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">Contact on pitch reports</h2>
        <p className="text-sm text-muted">Printed at the bottom of each club pitch report.</p>
        <Field label="Name" name="name" defaultValue={contact.name} />
        <Field label="Phone" name="phone" type="tel" defaultValue={contact.phone} />
        <Field label="Email" name="email" type="email" defaultValue={contact.email} />
        <button type="submit" className={primaryButton}>
          Save contact
        </button>
      </form>
      <form action={saveSocialLinks} className={`${panel} flex flex-col gap-4`}>
        <h2 className="text-lg font-semibold">BookOn&apos;s social accounts</h2>
        <p className="text-sm text-muted">
          Shown as &quot;Follow BookOn&quot; on the home page. Leave one empty to hide it.
        </p>
        {SOCIAL_NETWORKS.map((n) => (
          <Field
            key={n}
            label={`${NAMES[n]} page address`}
            name={n}
            defaultValue={links[n]}
            placeholder={`https://www.${n}.com/…`}
          />
        ))}
        <button type="submit" className={primaryButton}>
          Save
        </button>
      </form>
    </>
  );
}
