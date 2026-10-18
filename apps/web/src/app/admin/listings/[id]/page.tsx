import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applicationConsents,
  applicationDetails,
  clubApplicationById,
  listApplicationRates,
  listClubPhotos,
} from "@bookon/db";
import { approveListing, declineListing } from "@/app/admin/actions";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { ListingSummary } from "@/components/clubs/listing-summary";
import { TextArea } from "@/components/form";
import { Notice, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const db = getDb();
  const application = /^[0-9a-f-]{36}$/.test(id) ? await clubApplicationById(db, id) : null;
  if (!application) notFound();
  const rates = await listApplicationRates(db, application.id);
  const photos = await listClubPhotos(db, application.id);

  return (
    <>
      <PageTitle
        title={application.clubName}
        intro={
          <>
            From {application.contactName} ({application.contactEmail}) ·{" "}
            <Pill tone={application.status === "submitted" ? "warn" : "muted"}>
              {application.status}
            </Pill>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="warning">
            This listing can only be approved once the club has sent it.
          </Notice>
        </div>
      )}
      {application.status === "approved" && application.clubId && (
        <div className="mb-4">
          <Notice tone="info">
            Approved.{" "}
            <Link href={`/admin/clubs/${application.clubId}`} className="underline">
              Go to the club
            </Link>
          </Notice>
        </div>
      )}
      {application.reviewNotes && (
        <p className="mb-4 text-sm text-muted">Note: {application.reviewNotes}</p>
      )}

      {application.status === "submitted" && (
        <section className={`${panel} mb-6`} aria-labelledby="decide">
          <h2 id="decide" className="text-lg font-semibold">
            Decide
          </h2>
          <p className="mt-1 text-sm text-muted">
            Approving creates the club and its courses (switched off until you&apos;ve set up and
            tested their booking page), copies the prices and photos, and gives{" "}
            {application.contactEmail} a club login. The club is emailed either way, with your note.
          </p>
          <form className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="id" value={application.id} />
            <TextArea label="Note to the club" name="note" rows={2} maxLength={1000} />
            <div className="flex flex-wrap gap-3">
              <button formAction={approveListing} className={primaryButton}>
                Approve
              </button>
              <button formAction={declineListing} className={secondaryButton}>
                Decline
              </button>
            </div>
          </form>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Photos</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-lg border border-border text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/admin/photo/${p.id}`}
                  alt={p.caption ?? ""}
                  className="aspect-video w-full object-cover"
                />
                <p className="p-2 text-muted">
                  {p.caption ?? "No caption"} · rights: {p.rightsConfirmedBy}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ListingSummary
        details={applicationDetails(application)}
        rates={rates}
        photoCount={photos.length}
        consents={applicationConsents(application)}
        paymentsInterest={application.paymentsInterest}
      />
    </>
  );
}
