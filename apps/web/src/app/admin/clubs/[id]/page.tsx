import Link from "next/link";
import { notFound } from "next/navigation";
import {
  clubById,
  clubProfile,
  coursesForClub,
  listChangeLog,
  listChangeRequests,
  listClubMembers,
  listClubRates,
  listPhotosForClub,
} from "@bookon/db";
import { addMember, removeMember } from "@/app/admin/actions";
import { ChangeRequests } from "@/components/admin/change-requests";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { ListingSummary } from "@/components/clubs/listing-summary";
import { Field, Select } from "@/components/form";
import { Notice, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ClubAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { approved, error } = await searchParams;
  const db = getDb();
  const club = await clubById(db, id);
  if (!club) notFound();
  const courses = await coursesForClub(db, club.id);
  const members = await listClubMembers(db, club.id);
  const requests = await listChangeRequests(db, { status: "pending", clubId: club.id });
  const rates = await listClubRates(db, club.id);
  const photos = await listPhotosForClub(db, club.id);
  const log = await listChangeLog(db, { clubId: club.id, limit: 15 });
  const profile = clubProfile(club);
  const hasProfile = Object.keys(profile).length > 0;
  const when = (d: Date) =>
    d.toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <>
      <PageTitle
        title={club.name}
        intro={
          <Link href={`/club/${club.id}`} className="underline">
            Open the club&apos;s own view
          </Link>
        }
      />
      {approved && (
        <div className="mb-4">
          <Notice tone="info">
            Approved. The club has been emailed and can sign in. Next: set up each course&apos;s
            booking system below, test it with the worker, then switch it on.
          </Notice>
        </div>
      )}
      {error === "last-owner" && (
        <div className="mb-4">
          <Notice tone="warning">
            A club needs at least one owner. Make someone else an owner first.
          </Notice>
        </div>
      )}
      {error === "email" && (
        <div className="mb-4">
          <Notice tone="warning">That doesn&apos;t look like an email address.</Notice>
        </div>
      )}
      {requests.length > 0 && <ChangeRequests requests={requests} />}

      <section className={`${panel} mb-6`} aria-labelledby="courses">
        <h2 id="courses" className="text-lg font-semibold">
          Courses
        </h2>
        {courses.length === 0 && <p className="mt-2 text-muted">No courses yet.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <Link href={`/admin/courses/${c.slug}`} className="font-medium text-brand underline">
                {c.name}
              </Link>
              <Pill tone={c.enabled ? "good" : "muted"}>{c.enabled ? "On" : "Off"}</Pill>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${panel} mb-6`} aria-labelledby="logins">
        <h2 id="logins" className="text-lg font-semibold">
          Who can sign in
        </h2>
        {members.length === 0 && (
          <p className="mt-2 text-sm text-muted">
            Nobody yet. Add the club&apos;s contact to give them a login.
          </p>
        )}
        <ul className="mt-2 flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {m.email} <Pill tone={m.role === "owner" ? "good" : "muted"}>{m.role}</Pill>
              </span>
              <form action={removeMember}>
                <input type="hidden" name="clubId" value={club.id} />
                <input type="hidden" name="email" value={m.email} />
                <button type="submit" className="text-sm text-brand underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={addMember}
          className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end"
        >
          <input type="hidden" name="clubId" value={club.id} />
          <Field label="Email" name="email" type="email" required />
          <Select
            label="Role"
            name="role"
            required
            options={{ staff: "Staff", owner: "Owner" }}
            defaultValue="staff"
          />
          <button type="submit" className={secondaryButton}>
            Add and email them
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Owners can add and remove their own staff. Everyone signs in with an emailed link.
        </p>
      </section>

      {hasProfile ? (
        <ListingSummary details={profile} rates={rates} photoCount={photos.length} />
      ) : (
        <p className="text-sm text-muted">
          This club was added by BookOn, so it has no details from the club yet. Give it a login and
          the club can fill them in.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Changes</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-muted">No changes recorded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {log.map((l) => (
              <li key={l.id}>
                <span className="text-muted">{when(l.at)}</span> · {l.action}
                {l.courseName ? ` (${l.courseName})` : ""} · {l.actor}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
