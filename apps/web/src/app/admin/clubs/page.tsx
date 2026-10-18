import Link from "next/link";
import { listChangeRequests, listClubs } from "@bookon/db";
import { ChangeRequests } from "@/components/admin/change-requests";
import { PageTitle, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ClubsAdminPage() {
  await requireAdmin();
  const db = getDb();
  const clubs = await listClubs(db);
  const requests = await listChangeRequests(db, { status: "pending" });

  return (
    <>
      <PageTitle title="Clubs" intro="Every club, its courses and who can sign in for it." />
      {requests.length > 0 && <ChangeRequests requests={requests} />}
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Club</th>
              <th className={thClass}>Courses</th>
              <th className={thClass}>Logins</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id}>
                <td className={tdClass}>
                  <Link href={`/admin/clubs/${c.id}`} className="font-medium text-brand underline">
                    {c.name}
                  </Link>
                </td>
                <td className={tdClass}>{c.courseCount}</td>
                <td className={tdClass}>
                  {c.memberCount === 0 ? <span className="text-muted">None</span> : c.memberCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
