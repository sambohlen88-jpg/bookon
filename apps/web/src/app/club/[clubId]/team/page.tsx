import { listClubMembers } from "@bookon/db";
import { addTeamMember, removeTeamMember } from "@/app/club/actions";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { Field, Select } from "@/components/form";
import { Notice, secondaryButton } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";

const ERRORS: Record<string, string> = {
  owner: "Only owners can add or remove people.",
  email: "That doesn't look like an email address.",
  "last-owner": "Your club needs at least one owner. Make someone else an owner first.",
};

export default async function ClubTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clubId } = await params;
  const { error, added } = await searchParams;
  const { club, role, user } = await requireClub(clubId, `/club/${clubId}/team`);
  const members = await listClubMembers(getDb(), club.id);
  const owner = role === "owner";

  return (
    <>
      <PageTitle
        title="Team"
        intro="Everyone who can sign in for your club. They sign in with their email, no password."
      />
      {error && ERRORS[error] && (
        <div className="mb-4">
          <Notice tone="warning">{ERRORS[error]}</Notice>
        </div>
      )}
      {added && (
        <div className="mb-4">
          <Notice tone="info">Added. We&apos;ve emailed them how to sign in.</Notice>
        </div>
      )}
      <ul className="rounded-xl border border-border">
        {members.map((m) => (
          <li
            key={m.email}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm first:border-t-0"
          >
            <span>
              {m.email}
              {m.email === user.email.toLowerCase() ? " (you)" : ""}{" "}
              <Pill tone={m.role === "owner" ? "good" : "muted"}>{m.role}</Pill>
            </span>
            {owner && (
              <form action={removeTeamMember}>
                <input type="hidden" name="clubId" value={club.id} />
                <input type="hidden" name="email" value={m.email} />
                <button type="submit" className="text-brand underline">
                  Remove
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {owner ? (
        <form
          action={addTeamMember}
          className={`${panel} mt-6 grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end`}
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
            Add
          </button>
          <p className="text-xs text-muted md:col-span-3">
            Staff can update details, prices and photos and see reports. Owners can also add and
            remove people.
          </p>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Ask an owner to add or remove people.</p>
      )}
    </>
  );
}
