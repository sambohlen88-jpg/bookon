/** Form sections for a club's details, shared by onboarding and club logins. */
import { BOOKING_SYSTEMS, CLUB_KINDS, FACILITIES, type ClubApplicationDetails } from "@bookon/db";
import { Checkbox, Field, Fieldset, Select, TextArea } from "@/components/form";

export function ClubFields({ d }: { d: ClubApplicationDetails }) {
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

export function ContactFields({ d }: { d: ClubApplicationDetails }) {
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

export const yesNo = { yes: "Yes", no: "No" };
export const asYesNo = (v: boolean | undefined) => (v === undefined ? null : v ? "yes" : "no");

export function TeeTimeFields({ d }: { d: ClubApplicationDetails }) {
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

export function ExtrasFields({ d }: { d: ClubApplicationDetails }) {
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
