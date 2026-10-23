import Link from "next/link";
import { perthDate } from "@bookon/core";
import { coursesForClub } from "@bookon/db";
import { createClubEvent } from "@/app/club/[clubId]/events/actions";
import { PageTitle } from "@/components/admin/ui";
import { EventForm } from "@/components/clubs/event-form";
import { Notice } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function NewClubEvent({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/events/new`);
  const { problem } = await searchParams;
  const courses = await coursesForClub(getDb(), club.id);
  return (
    <>
      <Link href={`/club/${club.id}/events`} className="text-sm font-medium text-brand">
        ← Events
      </Link>
      <PageTitle title="Put on an event" />
      {problem && (
        <div className="mb-4">
          <Notice tone="warning">{problem}</Notice>
        </div>
      )}
      <EventForm
        action={createClubEvent}
        clubId={club.id}
        courses={courses}
        today={perthDate(new Date())}
      />
    </>
  );
}
