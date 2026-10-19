import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AREAS, SPECIALITIES, WEEKDAYS, formatAuPhone, type CoachProfile } from "@bookon/core";
import {
  COACH_CONSENT,
  coachContactCounts,
  coachForEmail,
  lessonPaymentSettings,
  lessonsForCoach,
  listCoachPhotos,
  listCourseDetails,
} from "@bookon/db";
import { refreshCoachPayments } from "@bookon/payments";
import { saveCoachListing, sendCoachListing } from "@/app/coach/actions";
import { CoachLessons } from "@/components/coach-lessons";
import { CoachPhotoUploader } from "@/components/coach-photo-uploader";
import { Checkbox, Field, Fieldset, Select, TextArea, fieldLabel } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { MAX_AWAY, MAX_PLACES, MAX_RATES } from "@/lib/coach-form";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My coaching · BookOn", robots: { index: false } };

const EMPTY: CoachProfile = {
  name: "",
  headline: "",
  bio: "",
  specialities: [],
  rates: [],
  hours: [],
  away: [],
  places: [],
  suburb: "",
  area: "",
  contact: {},
};

const PEOPLE = { "1": "1 person", "2": "2 people", group: "Per person, in a group" };
const PHOTO_STATUS = {
  pending: "Waiting for approval",
  approved: "On your page",
  declined: "Not used",
} as const;

/** A coach's own page: their listing, its status, photos and how many golfers got in touch. */
export default async function CoachPortal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/coach");
  const db = getDb();
  const query = await searchParams;
  const coach = await coachForEmail(db, user!.email);
  const courses = await listCourseDetails(db);
  const photos = coach ? await listCoachPhotos(db, coach.id) : [];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const contacts = coach?.profile ? await coachContactCounts(db, coach.id, since) : null;
  const v: CoachProfile = coach?.draft ??
    coach?.profile ?? { ...EMPTY, contact: { email: user!.email } };
  let problems: string[] = [];
  try {
    problems = query.problems ? (JSON.parse(query.problems) as string[]).slice(0, 12) : [];
  } catch {
    problems = [];
  }
  const consent = coach?.consents.public as { by?: string } | undefined;
  // Lesson bookings and payments (Milestone 15), once the listing is live.
  const ctx = coach?.status === "live" ? await lessonContext() : null;
  // Back from Stripe, or part-way through: ask Stripe whether the account is ready now.
  if (ctx && coach?.paymentAccountId && !coach.paymentsReady) {
    try {
      coach.paymentsReady = await refreshCoachPayments(ctx, coach);
    } catch {
      // Stripe didn't answer; the page still shows, and it's checked again next time.
    }
  }
  const lessons = coach && ctx ? await lessonsForCoach(db, coach.id, ctx.now) : null;
  const paymentSettings = await lessonPaymentSettings(db);
  const changesWaiting = Boolean(coach?.profile && coach.draft);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
        <h1 className="text-3xl font-bold tracking-tight">My coaching</h1>
        <p className="mt-1 text-muted">Signed in as {user!.email}.</p>

        <div className="mt-6 flex flex-col gap-3">
          {!coach && (
            <Notice tone="info">
              Fill in your listing below and send it to BookOn. We check every listing, including
              your PGA membership, before it goes live. It&apos;s free.
            </Notice>
          )}
          {coach?.status === "hidden" && (
            <Notice tone="warning">
              Your listing is hidden from golfers. Write to info@bookon.com.au if you&apos;re not
              sure why.
            </Notice>
          )}
          {coach?.submittedAt && (
            <Notice tone="info">
              Sent to BookOn for review. We&apos;ll email you once it&apos;s checked.
              {coach.profile ? " Your page shows your last approved details until then." : ""}
            </Notice>
          )}
          {coach && !coach.submittedAt && coach.reviewNote && (
            <Notice tone="warning">BookOn&apos;s note: {coach.reviewNote}</Notice>
          )}
          {coach && !coach.submittedAt && !coach.profile && (
            <Notice tone="info">Not on BookOn yet. Send your listing when it&apos;s ready.</Notice>
          )}
          {coach && !coach.submittedAt && changesWaiting && (
            <Notice tone="info">
              You have saved changes that aren&apos;t live yet. Send them to BookOn when you&apos;re
              ready.
            </Notice>
          )}
          {query.saved && <Notice tone="info">Saved.</Notice>}
          {query.done && (
            <Notice tone="info">
              {query.done === "accepted"
                ? "Accepted. The golfer's card is charged and we've emailed them to confirm."
                : query.done === "declined"
                  ? "Declined. The hold on the golfer's card is released and we've told them."
                  : "Cancelled. The golfer is refunded in full and we've told them."}
            </Notice>
          )}
          {query.bookings === "on" && (
            <Notice tone="info">Bookings are on. Golfers can now book and pay on your page.</Notice>
          )}
          {query.bookings === "off" && (
            <Notice tone="info">Bookings are off. Golfers can still contact you directly.</Notice>
          )}
          {query.problem && <Notice tone="warning">{query.problem}</Notice>}
          {query.sent && <Notice tone="info">Thanks, it&apos;s with BookOn to check.</Notice>}
          {problems.length > 0 && (
            <div className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">
              <p className="font-semibold">Saved, with a few things to fix before sending:</p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {coach?.profile && coach.status === "live" && (
          <section className="mt-6 rounded-xl border border-border p-4 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Live on BookOn</h2>
              <Link href={`/coaches/${coach.slug}`} className="font-medium text-brand">
                See your page
              </Link>
            </div>
            {contacts && (
              <p className="mt-2 text-sm text-muted">
                In the last 30 days, golfers tapped WhatsApp {contacts.whatsapp}{" "}
                {contacts.whatsapp === 1 ? "time" : "times"}, email {contacts.email}, call{" "}
                {contacts.phone} and your website {contacts.website}.
              </p>
            )}
          </section>
        )}

        {coach?.status === "live" && lessons && (
          <CoachLessons
            coach={coach}
            lessons={lessons}
            provider={ctx?.payments.kind ?? null}
            enabled={paymentSettings.enabled}
            feeCents={paymentSettings.feeCents}
            now={ctx!.now}
          />
        )}
        {coach?.status === "live" && !ctx && (
          <section id="payments" className="mt-6 rounded-xl border border-border p-4 md:p-6">
            <h2 className="text-lg font-semibold">Bookings and payments</h2>
            <p className="mt-2 text-sm text-muted">
              Booking and paying through BookOn isn&apos;t available right now. Golfers contact you
              directly.
            </p>
          </section>
        )}

        <form id="listing" className="mt-8 flex flex-col gap-6">
          <Fieldset legend="1. About you">
            <Field label="Your name" name="name" required defaultValue={v.name} maxLength={80} />
            <Field
              label="One line about your coaching"
              name="headline"
              required
              defaultValue={v.headline}
              maxLength={100}
              hint={'For example "Beginners, short game and women\'s golf".'}
            />
            <TextArea
              label="About your coaching"
              name="bio"
              required
              defaultValue={v.bio}
              maxLength={1500}
              rows={5}
              hint="What a lesson with you is like, who you love teaching, and your experience."
            />
            <Field
              label="PGA member number"
              name="pgaNumber"
              defaultValue={v.pgaNumber}
              maxLength={30}
              hint="BookOn checks it with PGA of Australia before showing you as a PGA Professional."
            />
          </Fieldset>

          <Fieldset legend="2. What you teach" hint="Pick everything you're happy to teach.">
            <div className="grid gap-x-4 sm:grid-cols-2">
              {SPECIALITIES.map((s) => (
                <Checkbox
                  key={s.id}
                  name="speciality"
                  value={s.id}
                  defaultChecked={v.specialities.includes(s.id)}
                >
                  {s.name}
                </Checkbox>
              ))}
            </div>
          </Fieldset>

          <Fieldset
            legend="3. Where you teach"
            hint="Pick a course or venue on BookOn, or type the name and suburb of anywhere else."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Suburb you're based in"
                name="suburb"
                required
                defaultValue={v.suburb}
                maxLength={60}
              />
              <Select
                label="Area"
                name="area"
                required
                defaultValue={v.area}
                options={Object.fromEntries(AREAS.map((a) => [a.id, a.name]))}
              />
            </div>
            {Array.from({ length: MAX_PLACES }, (_, i) => {
              const place = v.places[i];
              return (
                <div key={i} className="rounded-lg bg-surface p-3">
                  <p className="mb-2 text-sm font-semibold">Place {i + 1}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`f-place${i}Course`} className={fieldLabel}>
                        On BookOn
                      </label>
                      <select
                        id={`f-place${i}Course`}
                        name={`place${i}Course`}
                        defaultValue={place?.courseSlug ?? ""}
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
                    <Field
                      label="Or its name"
                      name={`place${i}Name`}
                      defaultValue={place?.courseSlug ? "" : place?.name}
                      maxLength={80}
                    />
                    <Field
                      label="Suburb"
                      name={`place${i}Suburb`}
                      defaultValue={place?.courseSlug ? "" : place?.suburb}
                      maxLength={60}
                    />
                  </div>
                </div>
              );
            })}
          </Fieldset>

          <Fieldset legend="4. Lessons and rates" hint="Prices include GST, as golfers pay them.">
            {Array.from({ length: MAX_RATES }, (_, i) => {
              const rate = v.rates[i];
              return (
                <div
                  key={i}
                  className="grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-[2fr_1fr_1fr_1.5fr]"
                >
                  <Field
                    label={`Lesson ${i + 1}`}
                    name={`rate${i}Name`}
                    defaultValue={rate?.name}
                    placeholder={i === 0 ? "Private lesson" : undefined}
                    maxLength={60}
                  />
                  <Field
                    label="Minutes"
                    name={`rate${i}Minutes`}
                    type="number"
                    min={10}
                    max={600}
                    defaultValue={rate?.minutes}
                  />
                  <Field
                    label="Price $"
                    name={`rate${i}Price`}
                    inputMode="decimal"
                    defaultValue={rate ? String(rate.priceCents / 100) : ""}
                  />
                  <div>
                    <label htmlFor={`f-rate${i}People`} className={fieldLabel}>
                      For
                    </label>
                    <select
                      id={`f-rate${i}People`}
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
                </div>
              );
            })}
          </Fieldset>

          <Fieldset
            legend="5. When you teach"
            hint="Your usual week. Leave a day empty if you don't teach then. Golfers see which days you teach this week and next."
          >
            {WEEKDAYS.map((label, i) => {
              const block = v.hours.find((h) => h.day === i + 1);
              return (
                <div key={label} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-3">
                  <span className="font-medium">{label}</span>
                  <input
                    type="time"
                    step={900}
                    name={`hours${i + 1}From`}
                    aria-label={`${label} from`}
                    defaultValue={block?.from}
                    className={textInput}
                  />
                  <input
                    type="time"
                    step={900}
                    name={`hours${i + 1}To`}
                    aria-label={`${label} to`}
                    defaultValue={block?.to}
                    className={textInput}
                  />
                </div>
              );
            })}
          </Fieldset>

          <Fieldset
            legend="6. Days away"
            hint="Holidays or tournaments. Those days won't show as teaching days."
          >
            {Array.from({ length: MAX_AWAY }, (_, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <Field
                  label="First day"
                  name={`away${i}From`}
                  type="date"
                  defaultValue={v.away[i]?.from}
                />
                <Field
                  label="Last day"
                  name={`away${i}To`}
                  type="date"
                  defaultValue={v.away[i]?.to}
                />
              </div>
            ))}
          </Fieldset>

          <Fieldset
            legend="7. How golfers reach you"
            hint="Add at least one. Golfers message or call you directly to book."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="WhatsApp mobile"
                name="whatsapp"
                type="tel"
                defaultValue={v.contact.whatsapp ? formatAuPhone(v.contact.whatsapp) : ""}
              />
              <Field
                label="Phone"
                name="phone"
                type="tel"
                defaultValue={v.contact.phone ? formatAuPhone(v.contact.phone) : ""}
              />
              <Field label="Email" name="email" type="email" defaultValue={v.contact.email} />
              <Field label="Website" name="website" defaultValue={v.contact.website} />
            </div>
          </Fieldset>

          <div className="rounded-xl border border-border p-4 md:p-6">
            <Checkbox name="consent" value="yes" defaultChecked={Boolean(consent)}>
              {COACH_CONSENT}
            </Checkbox>
            <Field
              label="Your name, to confirm"
              name="consentBy"
              defaultValue={consent?.by ?? v.name}
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button formAction={sendCoachListing} className={primaryButton}>
              {coach?.profile ? "Send changes to BookOn" : "Send to BookOn"}
            </button>
            <button formAction={saveCoachListing} className={secondaryButton}>
              Save without sending
            </button>
          </div>
        </form>

        {coach && (
          <section className="mt-10 rounded-xl border border-border p-4 md:p-6">
            <h2 className="text-lg font-semibold">Your photo</h2>
            {photos.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {photos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>Sent {p.createdAt.toLocaleDateString("en-AU")}</span>
                    <span className={p.status === "approved" ? "text-brand" : "text-muted"}>
                      {PHOTO_STATUS[p.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <CoachPhotoUploader defaultName={v.name} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}
