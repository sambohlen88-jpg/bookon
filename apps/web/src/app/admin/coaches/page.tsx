import Link from "next/link";
import { listCoachesForAdmin } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function AdminCoaches() {
  await requireAdmin();
  const coaches = await listCoachesForAdmin(getDb());
  return (
    <>
      <PageTitle
        title="Coaches"
        intro="Coach listings and changes waiting for review come first. Check each coach's PGA membership before approving."
      />
      {coaches.length === 0 ? (
        <p className="text-muted">No coaches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Coach</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>PGA</th>
                <th className={thClass}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    <Link href={`/admin/coaches/${c.id}`} className="font-medium text-brand">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted">{c.email}</span>
                  </td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      {c.submittedAt && (
                        <Pill tone="warn">{c.profile ? "Changes to check" : "New, to check"}</Pill>
                      )}
                      {c.pendingPhotos > 0 && <Pill tone="warn">Photo to check</Pill>}
                      <Pill tone={c.status === "live" ? "good" : "muted"}>
                        {
                          { new: "Not live", live: "Live", declined: "Declined", hidden: "Hidden" }[
                            c.status
                          ]
                        }
                      </Pill>
                      {c.sample && <Pill tone="muted">Sample</Pill>}
                    </span>
                  </td>
                  <td className={tdClass}>{c.pgaVerified ? "Checked" : "Not checked"}</td>
                  <td className={tdClass}>{c.updatedAt.toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
