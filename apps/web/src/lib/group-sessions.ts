import "server-only";
import { coachById, upcomingGroupSessions, type Database } from "@bookon/db";
import { coachTakesBookings } from "@bookon/payments";
import type { ListedSession } from "@/components/group-session-list";
import { lessonPayments } from "@/lib/lessons";

/**
 * Upcoming group sessions golfers can book now, across coaches (Milestone 19):
 * only coaches taking bookings through BookOn, with spots left first.
 */
export async function bookableGroupSessions(
  db: Database,
  now: Date,
  limit: number,
): Promise<ListedSession[]> {
  const payments = await lessonPayments();
  if (!payments) return [];
  const sessions = await upcomingGroupSessions(db, now);
  const coaches = new Map<string, { slug: string; name: string } | null>();
  // One after another: the local database takes one query at a time.
  for (const id of new Set(sessions.map((s) => s.coachId))) {
    const coach = await coachById(db, id);
    coaches.set(
      id,
      coach && (await coachTakesBookings({ db, payments }, coach))
        ? { slug: coach.slug, name: coach.profile!.name }
        : null,
    );
  }
  return sessions
    .filter((s) => coaches.get(s.coachId) && s.left > 0)
    .slice(0, limit)
    .map((s) => ({
      ...s,
      coachSlug: coaches.get(s.coachId)!.slug,
      coachName: coaches.get(s.coachId)!.name,
    }));
}
