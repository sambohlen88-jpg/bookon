import Link from "next/link";
import { coursesForClub } from "@bookon/db";
import { clubTakesEntries } from "@bookon/payments";
import { createMatchplay } from "@/app/club/[clubId]/matchplay/actions";
import { PageTitle } from "@/components/admin/ui";
import { CompForm } from "@/components/matchplay/comp-form";
import { Notice } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { lessonContext } from "@/lib/lessons";

export default async function NewClubMatchplay({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/matchplay/new`);
  const { problem } = await searchParams;
  const courses = await coursesForClub(getDb(), club.id);
  const ctx = await lessonContext();
  const canCharge = ctx ? await clubTakesEntries(ctx, club) : false;
  return (
    <>
      <Link href={`/club/${club.id}/matchplay`} className="text-sm font-medium text-brand">
        ← Match play
      </Link>
      <PageTitle title="Set up a match play competition" />
      {problem && (
        <div className="mb-4">
          <Notice tone="warning">{problem}</Notice>
        </div>
      )}
      <CompForm action={createMatchplay} clubId={club.id} courses={courses} canCharge={canCharge} />
    </>
  );
}
