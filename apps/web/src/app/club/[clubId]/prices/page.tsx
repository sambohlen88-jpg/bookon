import { clubProfile, coursesForClub, listClubRates } from "@bookon/db";
import { saveClubPrices } from "@/app/club/actions";
import { PageTitle } from "@/components/admin/ui";
import { RatesEditor } from "@/components/clubs/rates-editor";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ClubPricesPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/prices`);
  const db = getDb();
  const rates = await listClubRates(db, club.id);
  const courseNames =
    clubProfile(club).courses?.map((c) => c.name) ??
    (await coursesForClub(db, club.id)).map((c) => c.name);

  return (
    <>
      <PageTitle
        title="Prices"
        intro="Your full price list: green fees, carts, hire and deals. Changes save straight away."
      />
      <RatesEditor
        action={saveClubPrices}
        hidden={{ clubId: club.id }}
        submitLabel="Save prices"
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
