import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BOOKING_SYSTEMS,
  CLUB_KINDS,
  CONSENTS,
  FACILITIES,
  MAX_CLUB_PHOTOS,
  applicationByToken,
  applicationConsents,
  applicationDetails,
  applicationProblems,
  listApplicationRates,
  listClubPhotos,
  type ClubApplication,
  type ClubApplicationDetails,
  type ClubRate,
  type ConsentKey,
} from "@bookon/db";
import { describeRate } from "@bookon/email";
import { saveClubStep, submitClubListing } from "@/app/clubs/actions";
import { CoursesEditor } from "@/components/clubs/courses-editor";
import { PhotoUploader } from "@/components/clubs/photo-uploader";
import { RatesEditor } from "@/components/clubs/rates-editor";
import { Checkbox, Field, Fieldset, Select, TextArea, fieldLabel } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import {
  CLUB_STEPS,
  clubStepHref,
  isClubStep,
  previousClubStep,
  type ClubStep,
} from "@/lib/club-steps";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List your club · BookOn", robots: { index: false } };

export default async function ClubStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; step: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token, step } = await params;
  const { error, sent } = await searchParams;
  if (!isClubStep(step)) notFound();
  const db = getDb();
  const application = await applicationByToken(db, token);
  if (!application) redirect("/clubs/join?error=link");
  if (application.status !== "draft" && step !== "review") redirect(clubStepHref(token, "review"));
  const rates = await listApplicationRates(db, application.id);
  const photos = await listClubPhotos(db, application.id);
  const index = CLUB_STEPS.findIndex((s) => s.slug === step);
  const title = CLUB_STEPS[index]!.title;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:grid md:max-w-6xl md:grid-cols-[220px_minmax(0,1fr)] md:gap-12 md:px-6 md:pt-10">
        <nav aria-label="Listing steps" className="hidden md:block">
          <p className="font-semibold">{application.clubName}</p>
          <ol className="mt-4 flex flex-col gap-1 text-sm">
            {CLUB_STEPS.map((s, i) => (
              <li key={s.slug}>
                {application.status === "draft" ? (
                  <Link
                    href={clubStepHref(token, s.slug)}
                    aria-current={s.slug === step ? "step" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 ${s.slug === step ? "bg-surface font-semibold text-brand" : "text-muted hover:text-foreground"}`}
                  >
                    <span className="w-4 text-right">{i + 1}</span>
                    {s.title}
                  </Link>
                ) : (
                  <span className="flex min-h-10 items-center gap-3 px-3 text-muted">
                    <span className="w-4 text-right">{i + 1}</span>
                    {s.title}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-muted">
            Your answers save at each step. Use the link we emailed to come back.
          </p>
        </nav>

        <div className="min-w-0">
          <p className="text-sm text-muted">
            Step {index + 1} of {CLUB_STEPS.length}
            <span className="md:hidden"> · {application.clubName}</span>
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          {error && (
            <div className="mt-4">
              <Notice tone="warning">{error}</Notice>
            </div>
          )}
          <div className="mt-6">
            {step === "prices" ? (
              <PricesStep application={application} rates={rates} token={token} />
            ) : step === "review" ? (
              <ReviewStep
                application={application}
                rates={rates}
                photoCount={photos.length}
                token={token}
                justSent={sent === "1"}
              />
            ) : (
              <div className="flex flex-col gap-6">
                {/* The uploader is its own form, so it sits outside the step's form. */}
                {step === "extras" && (
                  <PhotosSection application={application} token={token} photos={photos} />
                )}
                <form action={saveClubStep} className="flex flex-col gap-6">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="step" value={step} />
                  <StepFields step={step} application={application} />
                  <StepButtons token={token} step={step} />
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function StepButtons({ token, step }: { token: string; step: ClubStep }) {
  const previous = previousClubStep(step);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className={primaryButton}>
        Save and continue
      </button>
      {previous && (
        <Link href={clubStepHref(token, previous)} className={secondaryButton}>
          Back
        </Link>
      )}
    </div>
  );
}

function StepFields({ step, application }: { step: ClubStep; application: ClubApplication }) {
  const d = applicationDetails(application);
  switch (step) {
    case "club":
      return <ClubFields d={d} />;
    case "contacts":
      return <ContactFields d={d} />;
    case "courses":
      return (
        <>
          <p className="text-muted">
            Each course or set of nines golfers can book. A 27 hole club might list one 27 hole
            course with its three nines.
          </p>
          <CoursesEditor initial={d.courses ?? []} />
        </>
      );
    case "tee-times":
      return <TeeTimeFields d={d} />;
    case "extras":
      return <ExtrasFields d={d} />;
    case "approvals":
      return <ApprovalFields application={application} />;
    default:
      return null;
  }
}

function ClubFields({ d }: { d: ClubApplicationDetails }) {
  const c = d.club;
  return (
    <>
      <Fieldset legend="The club">
        <Field label="Club name" name="name" required defaultValue={c?.name} />
        <Select label="What kind of club" name="kind" options={CLUB_KINDS} defaultValue={c?.kind} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Legal or trading name"
            name="legalName"
            defaultValue={c?.legalName}
            hint="If it's different, such as the company or council that runs the course."
          />
          <Field
            label="ABN"
            name="abn"
            inputMode="numeric"
            defaultValue={c?.abn}
            hint="11 digits."
          />
        </div>
      </Fieldset>
      <Fieldset legend="Where to find you">
        <Field
          label="Street address"
          name="street"
          defaultValue={c?.street}
          autoComplete="street-address"
        />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Suburb or town" name="suburb" required defaultValue={c?.suburb} />
          <Field
            label="Postcode"
            name="postcode"
            inputMode="numeric"
            maxLength={4}
            defaultValue={c?.postcode}
          />
          <Field
            label="State"
            name="state"
            required
            defaultValue={c?.state ?? "WA"}
            maxLength={3}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Website"
            name="website"
            inputMode="url"
            defaultValue={c?.website}
            placeholder="https://"
          />
          <Field label="Phone for golfers" name="phone" type="tel" defaultValue={c?.phone} />
          <Field
            label="Email for golfers"
            name="publicEmail"
            type="email"
            defaultValue={c?.publicEmail}
          />
        </div>
      </Fieldset>
    </>
  );
}

function PersonFields({
  prefix,
  person,
  required = false,
}: {
  prefix: string;
  person?: { name: string; role?: string; email: string; phone?: string };
  required?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name" name={`${prefix}Name`} required={required} defaultValue={person?.name} />
      <Field
        label="Role"
        name={`${prefix}Role`}
        defaultValue={person?.role}
        placeholder="For example: General manager"
      />
      <Field
        label="Email"
        name={`${prefix}Email`}
        type="email"
        required={required}
        defaultValue={person?.email}
      />
      <Field label="Phone" name={`${prefix}Phone`} type="tel" defaultValue={person?.phone} />
    </div>
  );
}

function ContactFields({ d }: { d: ClubApplicationDetails }) {
  return (
    <>
      <Fieldset legend="Main contact" hint="Who we talk to about your listing.">
        <PersonFields prefix="main" person={d.contacts?.main} required />
      </Fieldset>
      <Fieldset
        legend="Bookings contact"
        hint="The pro shop or whoever runs your tee sheet, if it's someone else."
      >
        <PersonFields prefix="bookings" person={d.contacts?.bookings} />
      </Fieldset>
      <Fieldset
        legend="Accounts contact"
        hint="For invoices, and for payouts if you take payments through BookOn later."
      >
        <PersonFields prefix="accounts" person={d.contacts?.accounts} />
      </Fieldset>
      <Fieldset legend="Reports">
        <Field
          label="Email for monthly reports"
          name="reportsEmail"
          type="email"
          defaultValue={d.contacts?.reportsEmail}
          hint="How many golfers saw your times and clicked through to book."
        />
      </Fieldset>
    </>
  );
}

const yesNo = { yes: "Yes", no: "No" };
const asYesNo = (v: boolean | undefined) => (v === undefined ? null : v ? "yes" : "no");

function TeeTimeFields({ d }: { d: ClubApplicationDetails }) {
  const t = d.teeTimes;
  return (
    <>
      <Fieldset legend="How golfers book">
        <Select
          label="Booking system"
          name="bookingSystem"
          required
          options={BOOKING_SYSTEMS}
          defaultValue={t?.bookingSystem}
        />
        <Field
          label="If something else, which"
          name="bookingSystemOther"
          defaultValue={t?.bookingSystemOther}
        />
        <Field
          label="Public booking page"
          name="bookingUrl"
          inputMode="url"
          defaultValue={t?.bookingUrl}
          placeholder="https://"
          hint="Where golfers book without logging in. We send golfers here, and read free times from it."
        />
      </Fieldset>
      <Fieldset legend="Your tee sheet">
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Minutes between tee times"
            name="intervalMinutes"
            type="number"
            min={4}
            max={30}
            defaultValue={t?.intervalMinutes}
          />
          <Field
            label="Days ahead the public can book"
            name="windowDays"
            type="number"
            min={1}
            max={365}
            defaultValue={t?.windowDays}
          />
          <Field
            label="Most players per group"
            name="maxPlayers"
            type="number"
            min={1}
            max={6}
            defaultValue={t?.maxPlayers ?? 4}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field
            label="First time, weekdays"
            name="weekdayFirst"
            type="time"
            defaultValue={t?.weekdayFirst}
          />
          <Field
            label="Last time, weekdays"
            name="weekdayLast"
            type="time"
            defaultValue={t?.weekdayLast}
          />
          <Field
            label="First time, weekends"
            name="weekendFirst"
            type="time"
            defaultValue={t?.weekendFirst}
          />
          <Field
            label="Last time, weekends"
            name="weekendLast"
            type="time"
            defaultValue={t?.weekendLast}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Do you start groups off the 1st and 10th tees?"
            name="twoTeeStarts"
            options={yesNo}
            defaultValue={asYesNo(t?.twoTeeStarts)}
          />
          <Select
            label="Can single golfers book?"
            name="singlesWelcome"
            options={yesNo}
            defaultValue={asYesNo(t?.singlesWelcome)}
          />
        </div>
      </Fieldset>
      <Fieldset legend="Rules golfers should know">
        <TextArea
          label="Times the public can't book"
          name="memberTimes"
          defaultValue={t?.memberTimes}
          hint="For example: member competitions Saturday 6 to 11 am."
        />
        <TextArea
          label="Cancellation policy"
          name="cancellationPolicy"
          defaultValue={t?.cancellationPolicy}
        />
        <TextArea
          label="Dress code"
          name="dressCode"
          defaultValue={t?.dressCode}
          rows={2}
          maxLength={500}
        />
      </Fieldset>
    </>
  );
}

function PricesStep({
  application,
  rates,
  token,
}: {
  application: ClubApplication;
  rates: ClubRate[];
  token: string;
}) {
  const courseNames = (applicationDetails(application).courses ?? []).map((c) => c.name);
  return (
    <>
      <p className="mb-6 text-muted">
        Your full price list: green fees for each day, time and type of golfer, carts, club hire,
        trolleys and deals. We start you with the usual lines; fill in the prices that apply and
        remove the rest. This lets golfers compare, and means everything is ready if you take
        bookings through BookOn later.
      </p>
      <RatesEditor
        token={token}
        backHref={clubStepHref(token, "tee-times")}
        courseNames={courseNames}
        saved={rates.map((r) => ({
          category: r.category,
          name: r.name,
          priceCents: r.priceCents,
          unit: r.unit,
          holes: r.holes,
          days: r.days,
          daysOfWeek: r.daysOfWeek,
          player: r.player,
          timeFrom: r.timeFrom,
          timeTo: r.timeTo,
          validFrom: r.validFrom,
          validTo: r.validTo,
          courseName: r.courseName,
          gstIncluded: r.gstIncluded,
          notes: r.notes,
        }))}
      />
    </>
  );
}

function ExtrasFields({ d }: { d: ClubApplicationDetails }) {
  const chosen = new Set(d.extras?.facilities ?? []);
  return (
    <>
      <Fieldset legend="About your course">
        <TextArea
          label="A few lines for your course page"
          name="description"
          defaultValue={d.extras?.description}
          maxLength={800}
          rows={4}
          hint="What makes it worth playing. Up to 800 characters."
        />
      </Fieldset>
      <Fieldset legend="Facilities">
        <div className="grid gap-x-6 md:grid-cols-3">
          {Object.entries(FACILITIES).map(([key, label]) => (
            <Checkbox
              key={key}
              name="facilities"
              value={key}
              defaultChecked={chosen.has(key as keyof typeof FACILITIES)}
            >
              {label}
            </Checkbox>
          ))}
        </div>
      </Fieldset>
    </>
  );
}

function PhotosSection({
  application,
  token,
  photos,
}: {
  application: ClubApplication;
  token: string;
  photos: Awaited<ReturnType<typeof listClubPhotos>>;
}) {
  return (
    <section aria-labelledby="photos" className="rounded-xl border border-border p-4 md:p-6">
      <h2 id="photos" className="text-lg font-semibold">
        Photos <span className="text-base font-normal text-muted">(optional)</span>
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Until you add photos, BookOn shows a drawing of a golf course. Photos upload straight away.
      </p>
      <PhotoUploader
        token={token}
        max={MAX_CLUB_PHOTOS}
        locked={application.status !== "draft"}
        defaultName={application.contactName}
        photos={photos.map((p) => ({ id: p.id, caption: p.caption, status: p.status }))}
      />
    </section>
  );
}

function ApprovalFields({ application }: { application: ClubApplication }) {
  const consents = applicationConsents(application);
  const d = applicationDetails(application);
  const by = Object.values(consents).find((c) => c?.by);
  return (
    <>
      <Fieldset legend="Listing terms">
        <div className="flex flex-col gap-2 text-sm text-muted">
          <p>
            <strong className="text-foreground">Free to list.</strong> BookOn doesn&apos;t charge
            clubs or golfers to list or to search.
          </p>
          <p>
            <strong className="text-foreground">Your bookings stay yours.</strong> Golfers book and
            pay on your booking page. We never take a booking or payment for you unless you sign up
            for that separately later.
          </p>
          <p>
            <strong className="text-foreground">Accurate and up to date.</strong> We show times and
            prices as your booking page shows them, and tell golfers how recently we checked.
          </p>
          <p>
            <strong className="text-foreground">Leave any time.</strong> Email info@bookon.com.au
            and we&apos;ll take your listing down within two working days.
          </p>
          <p>
            <strong className="text-foreground">Reports.</strong> We share how many golfers saw your
            times and clicked through. We don&apos;t share golfers&apos; personal details.
          </p>
        </div>
      </Fieldset>
      <Fieldset
        legend="Your approvals"
        hint="Required ones are marked. We record who ticked each one and when."
      >
        {(Object.keys(CONSENTS) as ConsentKey[]).map((key) => (
          <Checkbox key={key} name="consent" value={key} defaultChecked={consents[key]?.accepted}>
            {CONSENTS[key].text}{" "}
            <span className="text-sm text-muted">
              {CONSENTS[key].required ? "(required)" : "(optional)"}
            </span>
          </Checkbox>
        ))}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Your name"
            name="by"
            required
            defaultValue={by?.by ?? application.contactName}
          />
          <Field label="Your role" name="role" defaultValue={by?.role} />
        </div>
      </Fieldset>
      <Fieldset
        legend="Online bookings and payments (coming later)"
        hint="BookOn doesn't take payments yet. If you'd like golfers to book and pay through BookOn one day, tell us now and we'll be in touch first. We'll ask for bank details then, through a secure payments provider, never on this form."
      >
        <div>
          <p className={fieldLabel}>Interested?</p>
          <div className="flex flex-wrap gap-x-6">
            {(["yes", "maybe", "no"] as const).map((v) => (
              <label key={v} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="paymentsInterest"
                  value={v}
                  defaultChecked={application.paymentsInterest === v}
                  className="size-5 accent-brand"
                />
                {v === "yes" ? "Yes" : v === "maybe" ? "Maybe" : "No"}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Registered for GST?"
            name="gstRegistered"
            options={yesNo}
            defaultValue={asYesNo(d.payments?.gstRegistered)}
          />
          <Field
            label="Business name payouts would go to"
            name="payoutBusinessName"
            defaultValue={d.payments?.payoutBusinessName}
          />
        </div>
      </Fieldset>
    </>
  );
}

function Section({
  title,
  href,
  editable,
  children,
}: {
  title: string;
  href: string;
  editable: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {editable && (
          <Link href={href} className="text-sm font-medium text-brand underline">
            Change
          </Link>
        )}
      </div>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

function ReviewStep({
  application,
  rates,
  photoCount,
  token,
  justSent,
}: {
  application: ClubApplication;
  rates: ClubRate[];
  photoCount: number;
  token: string;
  justSent: boolean;
}) {
  const d = applicationDetails(application);
  const consents = applicationConsents(application);
  const draft = application.status === "draft";
  const problems = applicationProblems(application, rates);
  const href = (s: ClubStep) => clubStepHref(token, s);
  const line = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      {!draft && (
        <Notice tone="info">
          {justSent ? "Sent. Thanks! " : ""}
          {application.status === "submitted"
            ? `We've got your listing and will be in touch at ${application.contactEmail}, usually within a week. To change anything now, email info@bookon.com.au.`
            : application.status === "approved"
              ? "Your listing is approved. To change anything, email info@bookon.com.au."
              : "This listing is closed. Email info@bookon.com.au with any questions."}
        </Notice>
      )}
      <Section title="Your club" href={href("club")} editable={draft}>
        <p className="font-medium">{d.club?.name}</p>
        <p className="text-muted">
          {line(
            d.club?.kind && CLUB_KINDS[d.club.kind],
            d.club?.legalName,
            d.club?.abn && `ABN ${d.club.abn}`,
          )}
        </p>
        <p className="text-muted">
          {line(d.club?.street, d.club?.suburb, d.club?.state, d.club?.postcode)}
        </p>
        <p className="text-muted">{line(d.club?.website, d.club?.phone, d.club?.publicEmail)}</p>
      </Section>
      <Section title="Contacts" href={href("contacts")} editable={draft}>
        {(["main", "bookings", "accounts"] as const).map((k) => {
          const p = d.contacts?.[k];
          return p ? (
            <p key={k}>
              <span className="text-muted">
                {k === "main" ? "Main" : k === "bookings" ? "Bookings" : "Accounts"}:
              </span>{" "}
              {line(p.name, p.role, p.email, p.phone)}
            </p>
          ) : null;
        })}
        {d.contacts?.reportsEmail && (
          <p>
            <span className="text-muted">Reports:</span> {d.contacts.reportsEmail}
          </p>
        )}
      </Section>
      <Section title="Courses" href={href("courses")} editable={draft}>
        {(d.courses ?? []).length === 0 && <p className="text-muted">None yet.</p>}
        {(d.courses ?? []).map((c) => (
          <p key={c.name}>
            {line(c.name, `${c.holes} holes`, c.par ? `par ${c.par}` : null, c.layouts)}
          </p>
        ))}
      </Section>
      <Section title="Tee times" href={href("tee-times")} editable={draft}>
        {d.teeTimes ? (
          <>
            <p>
              {BOOKING_SYSTEMS[d.teeTimes.bookingSystem]}
              {d.teeTimes.bookingUrl ? ` · ${d.teeTimes.bookingUrl}` : ""}
            </p>
            <p className="text-muted">
              {line(
                d.teeTimes.intervalMinutes ? `every ${d.teeTimes.intervalMinutes} minutes` : null,
                d.teeTimes.windowDays ? `${d.teeTimes.windowDays} days ahead` : null,
                d.teeTimes.weekdayFirst && d.teeTimes.weekdayLast
                  ? `weekdays ${d.teeTimes.weekdayFirst}–${d.teeTimes.weekdayLast}`
                  : null,
                d.teeTimes.weekendFirst && d.teeTimes.weekendLast
                  ? `weekends ${d.teeTimes.weekendFirst}–${d.teeTimes.weekendLast}`
                  : null,
              )}
            </p>
          </>
        ) : (
          <p className="text-muted">Not filled in yet.</p>
        )}
      </Section>
      <Section title={`Prices (${rates.length})`} href={href("prices")} editable={draft}>
        {rates.length === 0 && <p className="text-muted">None yet.</p>}
        <ul className="flex flex-col gap-1">
          {rates.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.name}</span>{" "}
              <span className="text-muted">
                {describeRate(r)}
                {r.gstIncluded ? "" : " + GST"}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Photos and facilities" href={href("extras")} editable={draft}>
        <p>
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
          {(d.extras?.facilities ?? []).length > 0 &&
            ` · ${(d.extras?.facilities ?? []).map((f) => FACILITIES[f]).join(", ")}`}
        </p>
        {d.extras?.description && <p className="mt-1 text-muted">{d.extras.description}</p>}
      </Section>
      <Section title="Approvals" href={href("approvals")} editable={draft}>
        <ul className="flex flex-col gap-1">
          {(Object.keys(CONSENTS) as ConsentKey[]).map((k) => (
            <li key={k}>
              {consents[k]?.accepted ? "✓" : "✗"} {CONSENTS[k].text}
            </li>
          ))}
        </ul>
        {application.paymentsInterest && (
          <p className="mt-2 text-muted">
            Interested in payments through BookOn: {application.paymentsInterest}
          </p>
        )}
      </Section>

      {draft &&
        (problems.length > 0 ? (
          <Notice tone="warning">Before you send it, add: {problems.join(", ")}.</Notice>
        ) : (
          <form action={submitClubListing} className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <p className="text-muted">
              When you send it, we&apos;ll check everything and email you when your club is live.
            </p>
            <div>
              <button type="submit" className={primaryButton}>
                Send to BookOn
              </button>
            </div>
          </form>
        ))}
    </div>
  );
}
