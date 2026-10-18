/** Everything a club has told us, section by section. Used for review in onboarding and admin. */
import Link from "next/link";
import {
  BOOKING_SYSTEMS,
  CLUB_KINDS,
  CONSENTS,
  FACILITIES,
  type ClubApplicationDetails,
  type ClubRate,
  type ConsentKey,
  type ConsentRecord,
} from "@bookon/db";
import { describeRate } from "@bookon/email";
import type { ClubStep } from "@/lib/club-steps";

function Section({
  title,
  step,
  editHref,
  children,
}: {
  title: string;
  step: ClubStep;
  editHref?: ((step: ClubStep) => string | null) | null;
  children: React.ReactNode;
}) {
  const href = editHref?.(step);
  return (
    <section className="rounded-xl border border-border p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-medium text-brand underline">
            Change
          </Link>
        )}
      </div>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

export function ListingSummary({
  details: d,
  rates,
  photoCount,
  consents,
  paymentsInterest,
  editHref,
}: {
  details: ClubApplicationDetails;
  rates: ClubRate[];
  photoCount: number;
  /** Approvals, for a listing. A live club's profile has none. */
  consents?: Partial<Record<ConsentKey, ConsentRecord>>;
  paymentsInterest?: string | null;
  /** Where each section's Change link goes, or nothing for read only. */
  editHref?: ((step: ClubStep) => string | null) | null;
}) {
  const line = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-4">
      <Section editHref={editHref} title="Your club" step="club">
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
      <Section editHref={editHref} title="Contacts" step="contacts">
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
      <Section editHref={editHref} title="Courses" step="courses">
        {(d.courses ?? []).length === 0 && <p className="text-muted">None yet.</p>}
        {(d.courses ?? []).map((c) => (
          <p key={c.name}>
            {line(c.name, `${c.holes} holes`, c.par ? `par ${c.par}` : null, c.layouts)}
          </p>
        ))}
      </Section>
      <Section editHref={editHref} title="Tee times" step="tee-times">
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
      <Section editHref={editHref} title={`Prices (${rates.length})`} step="prices">
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
      <Section editHref={editHref} title="Photos and facilities" step="extras">
        <p>
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
          {(d.extras?.facilities ?? []).length > 0 &&
            ` · ${(d.extras?.facilities ?? []).map((f) => FACILITIES[f]).join(", ")}`}
        </p>
        {d.extras?.description && <p className="mt-1 text-muted">{d.extras.description}</p>}
      </Section>
      {consents && (
        <Section editHref={editHref} title="Approvals" step="approvals">
          <ul className="flex flex-col gap-1">
            {(Object.keys(CONSENTS) as ConsentKey[]).map((k) => (
              <li key={k}>
                {consents[k]?.accepted ? "✓" : "✗"} {CONSENTS[k].text}
              </li>
            ))}
          </ul>
          {paymentsInterest && (
            <p className="mt-2 text-muted">
              Interested in payments through BookOn: {paymentsInterest}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
