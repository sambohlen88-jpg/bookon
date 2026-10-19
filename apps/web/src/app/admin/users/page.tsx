import Link from "next/link";
import { USER_GROUPS, isUserGroup, listUsersForAdmin } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, textInput } from "@/components/ui";
import { adminEmail, requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

const NAMES = Object.fromEntries(USER_GROUPS.map((g) => [g.id, g.name]));

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const group = isUserGroup(query.group) ? query.group : null;
  const words = (query.q ?? "").trim().toLowerCase();
  const all = await listUsersForAdmin(getDb(), adminEmail());
  const shown = all.filter(
    (u) => (!group || u.groups.includes(group)) && (!words || u.email.includes(words)),
  );
  const href = (g: string | null) =>
    `/admin/users?${new URLSearchParams({ ...(g ? { group: g } : {}), ...(words ? { q: words } : {}) })}`;
  return (
    <>
      <PageTitle
        title="Users"
        intro="Everyone with an account. Groups come from what each person can do: club owners and staff are added on the club's page, coaches through their listing, and you are the only admin."
      />
      {query.deleted && (
        <div className="mb-4">
          <Notice tone="info">Account deleted.</Notice>
        </div>
      )}
      {!adminEmail() && (
        <div className="mb-4">
          <Notice tone="warning">No admin is set. Set BOOKON_ADMIN_EMAIL to your email.</Notice>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Groups">
        {[{ id: null, name: "Everyone" }, ...USER_GROUPS].map((g) => {
          const n = g.id ? all.filter((u) => u.groups.includes(g.id!)).length : all.length;
          const on = group === g.id;
          return (
            <Link
              key={g.id ?? "all"}
              href={href(g.id)}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                on ? "border-brand bg-brand text-brand-foreground" : "border-border"
              }`}
            >
              {g.name} <span className={on ? "" : "text-muted"}>{n}</span>
            </Link>
          );
        })}
      </div>
      <form method="get" className="mb-4 max-w-sm">
        {group && <input type="hidden" name="group" value={group} />}
        <label htmlFor="q" className="sr-only">
          Search by email
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={words}
          placeholder="Search by email"
          className={textInput}
        />
      </form>
      {shown.length === 0 ? (
        <p className="text-muted">Nobody matches.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Email</th>
                <th className={thClass}>Groups</th>
                <th className={thClass}>Joined</th>
                <th className={thClass}>Last signed in</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-brand">
                      {u.email}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      {u.groups.map((g) => (
                        <Pill key={g} tone={g === "customer" ? "muted" : "good"}>
                          {NAMES[g]}
                        </Pill>
                      ))}
                    </span>
                  </td>
                  <td className={tdClass}>{u.createdAt.toLocaleDateString("en-AU")}</td>
                  <td className={tdClass}>
                    {u.lastSignInAt ? u.lastSignInAt.toLocaleDateString("en-AU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
