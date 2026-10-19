import Link from "next/link";
import { notFound } from "next/navigation";
import { USER_GROUPS, userForAdmin } from "@bookon/db";
import { deleteUserAccount } from "@/app/admin/user-actions";
import { PageTitle, Pill, panel } from "@/components/admin/ui";
import { fieldLabel } from "@/components/form";
import { Notice, secondaryButton, textInput } from "@/components/ui";
import { adminEmail, requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

const NAMES = Object.fromEntries(USER_GROUPS.map((g) => [g.id, g.name]));

export default async function AdminUser({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const user = await userForAdmin(getDb(), (await params).id, adminEmail());
  if (!user) notFound();
  const { error } = await searchParams;
  const isAdmin = user!.groups.includes("admin");
  return (
    <>
      <Link href="/admin/users" className="text-sm font-medium text-brand">
        ← Users
      </Link>
      <div className="mt-3">
        <PageTitle
          title={user!.email}
          intro={`Joined ${user!.createdAt.toLocaleDateString("en-AU")}${
            user!.lastSignInAt
              ? ` · last signed in ${user!.lastSignInAt.toLocaleDateString("en-AU")}`
              : ""
          }`}
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {user!.groups.map((g) => (
          <Pill key={g} tone={g === "customer" ? "muted" : "good"}>
            {NAMES[g]}
          </Pill>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-lg font-semibold">On BookOn</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              {user!.favourites} starred {user!.favourites === 1 ? "course" : "courses"} ·{" "}
              {user!.alerts} {user!.alerts === 1 ? "alert" : "alerts"}
            </li>
            {user!.clubs.map((c) => (
              <li key={c.id}>
                {c.role === "owner" ? "Owner" : "Staff"} at{" "}
                <Link href={`/admin/clubs/${c.id}`} className="font-medium text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
            {user!.coach && (
              <li>
                Coach listing:{" "}
                <Link href={`/admin/coaches/${user!.coach.id}`} className="font-medium text-brand">
                  {user!.coach.name}
                </Link>{" "}
                ({user!.coach.status})
              </li>
            )}
            {isAdmin && <li>The admin (set by BOOKON_ADMIN_EMAIL).</li>}
          </ul>
          <p className="mt-4 text-sm text-muted">
            To change someone&apos;s club access, use the club&apos;s page. Coach listings are
            managed on the coach&apos;s page.
          </p>
        </section>

        <section className={panel}>
          <h2 className="text-lg font-semibold">Delete account</h2>
          {isAdmin ? (
            <p className="mt-2 text-sm text-muted">You can&apos;t delete the admin account.</p>
          ) : (
            <form action={deleteUserAccount} className="mt-2 flex flex-col gap-3">
              <p className="text-sm text-muted">
                For privacy requests. Deletes their sign-ins, starred courses, alerts and history.
                Club access and coach listings stay with the club or listing.
              </p>
              {error === "confirm" && (
                <Notice tone="warning">Type the email address exactly to confirm.</Notice>
              )}
              <input type="hidden" name="id" value={user!.id} />
              <div>
                <label htmlFor="confirm" className={fieldLabel}>
                  Type {user!.email} to confirm
                </label>
                <input id="confirm" name="confirm" autoComplete="off" className={textInput} />
              </div>
              <button type="submit" className={secondaryButton}>
                Delete this account
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
