import Link from "next/link";
import { notFound } from "next/navigation";
import {
  WEEKDAYS,
  areaName,
  formatAuPhone,
  formatPrice,
  specialityName,
  type CoachProfile,
} from "@bookon/core";
import { coachById, coachContactCounts, listCoachPhotos } from "@bookon/db";
import {
  approveCoachAction,
  approveCoachPhoto,
  declineCoachAction,
  declineCoachPhoto,
  hideCoach,
  saveCoachLocation,
  showCoach,
  unverifyCoachPga,
  verifyCoachPga,
} from "@/app/admin/coach-actions";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { Field, fieldLabel } from "@/components/form";
import { Notice, primaryButton, secondaryButton, textInput } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { clockLabel } from "@/lib/coaches";
import { getDb } from "@/lib/db";

export default async function AdminCoach({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const db = getDb();
  const coach = await coachById(db, (await params).id);
  if (!coach) notFound();
  const query = await searchParams;
  const photos = await listCoachPhotos(db, coach!.id);
  const contacts = await coachContactCounts(
    db,
    coach!.id,
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const toReview = coach!.draft;
  const shown = toReview ?? coach!.profile;
  const hidden = { name: "id", value: coach!.id };

  return (
    <>
      <Link href="/admin/coaches" className="text-sm font-medium text-brand">
        ← Coaches
      </Link>
      <div className="mt-3">
        <PageTitle title={shown?.name ?? coach!.email} intro={coach!.email} />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Pill tone={coach!.status === "live" ? "good" : "muted"}>{coach!.status}</Pill>
        {coach!.submittedAt && <Pill tone="warn">Sent for review</Pill>}
        {coach!.pgaVerified ? (
          <Pill tone="good">PGA checked</Pill>
        ) : (
          <Pill tone="muted">PGA not checked</Pill>
        )}
        {coach!.sample && <Pill tone="muted">Sample</Pill>}
      </div>
      {query.done && (
        <div className="mb-4">
          <Notice tone="info">
            {query.done === "approved"
              ? "Approved, and the coach was emailed."
              : "Declined, and the coach was emailed."}
          </Notice>
        </div>
      )}
      {query.error === "location" && (
        <div className="mb-4">
          <Notice tone="warning">That location isn&apos;t in Western Australia.</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          {toReview && (
            <p className="text-sm text-muted">
              {coach!.profile
                ? "Showing the coach's changes. Golfers still see the live version until you approve."
                : "Not live yet."}
              {coach!.profile && coach!.status === "live" && (
                <>
                  {" "}
                  <Link href={`/coaches/${coach!.slug}`} className="text-brand underline">
                    Live page
                  </Link>
                </>
              )}
            </p>
          )}
          {shown ? (
            <Summary profile={shown} />
          ) : (
            <p className="text-muted">Nothing filled in yet.</p>
          )}

          <section className={panel}>
            <h2 className="text-lg font-semibold">Photos</h2>
            {photos.length === 0 && <p className="mt-2 text-sm text-muted">No photos.</p>}
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {photos.map((p) => (
                <li key={p.id} className="rounded-lg border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/admin/coach-photo/${p.id}`}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <p className="mt-2 text-sm">
                    {p.status} · confirmed by {p.rightsConfirmedBy}
                  </p>
                  {p.status === "pending" && (
                    <form className="mt-2 flex gap-2">
                      <input type="hidden" {...hidden} />
                      <input type="hidden" name="photoId" value={p.id} />
                      <button formAction={approveCoachPhoto} className={secondaryButton}>
                        Approve
                      </button>
                      <button formAction={declineCoachPhoto} className={secondaryButton}>
                        Decline
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          {toReview && coach!.submittedAt && (
            <form className={`${panel} flex flex-col gap-3`}>
              <h2 className="text-lg font-semibold">Decide</h2>
              <input type="hidden" {...hidden} />
              <div>
                <label htmlFor="note" className={fieldLabel}>
                  Note to the coach (optional)
                </label>
                <textarea id="note" name="note" rows={3} className={`${textInput} py-2`} />
              </div>
              <button formAction={approveCoachAction} className={primaryButton}>
                Approve
              </button>
              <button formAction={declineCoachAction} className={secondaryButton}>
                Decline
              </button>
            </form>
          )}
          <form className={`${panel} flex flex-col gap-3`}>
            <h2 className="text-lg font-semibold">PGA membership</h2>
            <p className="text-sm text-muted">
              Number given: {shown?.pgaNumber ?? "none"}. Check it with PGA of Australia (Find a PGA
              Professional) before ticking.
            </p>
            <input type="hidden" {...hidden} />
            {coach!.pgaVerified ? (
              <button formAction={unverifyCoachPga} className={secondaryButton}>
                Untick PGA membership
              </button>
            ) : (
              <button formAction={verifyCoachPga} className={primaryButton}>
                PGA membership checked
              </button>
            )}
          </form>
          <form className={`${panel} flex flex-col gap-3`}>
            <h2 className="text-lg font-semibold">Map location</h2>
            <p className="text-sm text-muted">
              For Near me. Set from their BookOn course when approved.
            </p>
            <input type="hidden" {...hidden} />
            <Field label="Latitude" name="latitude" defaultValue={coach!.latitude ?? ""} />
            <Field label="Longitude" name="longitude" defaultValue={coach!.longitude ?? ""} />
            <button formAction={saveCoachLocation} className={secondaryButton}>
              Save location
            </button>
          </form>
          <form className={`${panel} flex flex-col gap-3`}>
            <h2 className="text-lg font-semibold">On the site</h2>
            <p className="text-sm text-muted">
              Contact taps, last 30 days: WhatsApp {contacts.whatsapp}, email {contacts.email}, call{" "}
              {contacts.phone}, website {contacts.website}.
            </p>
            <input type="hidden" {...hidden} />
            {coach!.status === "hidden" ? (
              <button formAction={showCoach} className={secondaryButton}>
                Show again
              </button>
            ) : (
              coach!.profile && (
                <button formAction={hideCoach} className={secondaryButton}>
                  Hide from golfers
                </button>
              )
            )}
          </form>
        </aside>
      </div>
    </>
  );
}

const PEOPLE = { "1": "1 person", "2": "2 people", group: "per person" } as const;

function Summary({ profile }: { profile: CoachProfile }) {
  const rows: [string, React.ReactNode][] = [
    ["Headline", profile.headline],
    [
      "About",
      <span key="bio" className="whitespace-pre-line">
        {profile.bio}
      </span>,
    ],
    ["Specialities", profile.specialities.map(specialityName).join(", ")],
    ["Based", `${profile.suburb} · ${areaName(profile.area)}`],
    ["Teaches at", profile.places.map((p) => `${p.name} (${p.suburb})`).join("; ")],
    [
      "Rates",
      profile.rates
        .map(
          (r) => `${r.name}, ${r.minutes} min, ${PEOPLE[r.people]}: ${formatPrice(r.priceCents)}`,
        )
        .join("; "),
    ],
    [
      "Hours",
      profile.hours
        .map((h) => `${WEEKDAYS[h.day - 1]} ${clockLabel(h.from)} to ${clockLabel(h.to)}`)
        .join("; "),
    ],
    ["Away", profile.away.map((a) => `${a.from} to ${a.to}`).join("; ") || "None"],
    [
      "Contact",
      [
        profile.contact.whatsapp && `WhatsApp ${formatAuPhone(profile.contact.whatsapp)}`,
        profile.contact.phone && `Phone ${formatAuPhone(profile.contact.phone)}`,
        profile.contact.email,
        profile.contact.website,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
  ];
  return (
    <dl className={`${panel} grid gap-3 text-sm sm:grid-cols-[8rem_1fr]`}>
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-medium">{label}</dt>
          <dd className="text-muted">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
