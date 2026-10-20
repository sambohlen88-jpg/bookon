import { formatPrice, formatPublicHolidays, formatSchoolHolidays } from "@bookon/core";
import {
  SOCIAL_NETWORKS,
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
import { savePitchContact, saveWaCalendar } from "@/app/admin/settings-actions";
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
