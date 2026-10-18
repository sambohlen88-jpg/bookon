import { clubProfile } from "@bookon/db";
import { saveClubDetails } from "@/app/club/actions";
import { PageTitle } from "@/components/admin/ui";
import {
  ClubFields,
  ContactFields,
  ExtrasFields,
  TeeTimeFields,
} from "@/components/clubs/profile-fields";
import { Notice, primaryButton } from "@/components/ui";
import { requireClub } from "@/lib/access";

export default async function ClubDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { error, saved } = await searchParams;
  const { club } = await requireClub(clubId, `/club/${clubId}/details`);
  const profile = clubProfile(club);
  // Clubs BookOn added itself start with just a name.
  const d = { ...profile, club: profile.club ?? { name: club.name, suburb: "", state: "WA" } };

  return (
    <>
      <PageTitle
        title="Details"
        intro="What golfers see about your club, and who we talk to. Changes go live straight away."
      />
      {error && (
        <div className="mb-4">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {saved && (
        <div className="mb-4">
          <Notice tone="info">
            Saved.
            {saved === "booking" &&
              " Your new booking page has gone to BookOn to check, as it changes where we send golfers. We'll switch over once it's confirmed."}
          </Notice>
        </div>
      )}
      <form action={saveClubDetails} className="flex flex-col gap-6">
        <input type="hidden" name="clubId" value={club.id} />
        <ClubFields d={d} />
        <ContactFields d={d} />
        <TeeTimeFields d={d} />
        <ExtrasFields d={d} />
        <div>
          <button type="submit" className={primaryButton}>
            Save details
          </button>
        </div>
      </form>
    </>
  );
}
