import Link from "next/link";
import { notFound } from "next/navigation";
import { perthDate } from "@bookon/core";
import { coursesForClub, eventById, placesTaken } from "@bookon/db";
import { updateClubEvent } from "@/app/club/[clubId]/events/actions";
import { PageTitle } from "@/components/admin/ui";
import { EventForm } from "@/components/clubs/event-form";
import { Notice } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function EditClubEvent({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string; eventId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId, eventId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/events/${eventId}/edit`);
  const db = getDb();
  const event = await eventById(db, eventId);
  if (!event || event.clubId !== club.id) notFound();
  const { problem } = await searchParams;
  const now = new Date();
  const taken = (await placesTaken(db, [event.id], now)).get(event.id) ?? 0;
  const courses = await coursesForClub(db, club.id);
  return (
    <>
      <Link href={`/club/${club.id}/events/${event.id}`} className="text-sm font-medium text-brand">
        ← {event.title}
      </Link>
      <PageTitle title="Change the event" />
      {problem && (
        <div className="mb-4">
          <Notice tone="warning">{problem}</Notice>
        </div>
      )}
      <EventForm
        action={updateClubEvent}
        clubId={club.id}
        courses={courses}
        event={event}
        locked={taken > 0}
        today={perthDate(now)}
      />
    </>
  );
}
