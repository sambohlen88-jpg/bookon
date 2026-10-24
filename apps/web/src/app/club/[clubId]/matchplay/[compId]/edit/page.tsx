import Link from "next/link";
import { notFound } from "next/navigation";
import { compById, coursesForClub, entryCounts } from "@bookon/db";
import { clubTakesEntries } from "@bookon/payments";
import { updateMatchplay } from "@/app/club/[clubId]/matchplay/actions";
import { PageTitle } from "@/components/admin/ui";
import { CompForm } from "@/components/matchplay/comp-form";
import { Notice } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export default async function EditClubMatchplay({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string; compId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId, compId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/matchplay/${compId}/edit`);
  const db = getDb();
  const comp = await compById(db, compId);
  if (!comp || comp.clubId !== club.id) notFound();
  const { problem } = await searchParams;
  const entered = (await entryCounts(db, [comp.id], new Date())).get(comp.id) ?? 0;
  const courses = await coursesForClub(db, club.id);
  const ctx = await lessonContext();
  const canCharge = ctx ? await clubTakesEntries(ctx, club) : false;
  return (
    <>
      <Link
        href={`/club/${club.id}/matchplay/${comp.id}`}
        className="text-sm font-medium text-brand"
      >
        ← {comp.title}
      </Link>
      <PageTitle title="Change the competition" />
      {problem && (
        <div className="mb-4">
          <Notice tone="warning">{problem}</Notice>
        </div>
      )}
      {comp.status !== "entries" ? (
        <Notice tone="info">The draw has been made, so the details can&apos;t change now.</Notice>
      ) : (
        <CompForm
          action={updateMatchplay}
          clubId={club.id}
          courses={courses}
          comp={comp}
          locked={entered > 0}
          canCharge={canCharge || comp.feeCents > 0}
        />
      )}
    </>
  );
}
