import Link from "next/link";
import { listChangeLog } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export default async function ChangeLogPage() {
  await requireAdmin();
  const log = await listChangeLog(getDb(), { limit: 200 });
  return (
    <>
      <PageTitle title="Change log" intro="Who changed what, newest first. The last 200 changes." />
      {log.length === 0 ? (
        <p className="text-muted">No changes yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>What</th>
                <th className={thClass}>Club or course</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {l.at.toLocaleString("en-AU", {
                      timeZone: "Australia/Perth",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className={tdClass}>
                    {l.actor}{" "}
                    <Pill tone={l.actorRole === "admin" ? "good" : "muted"}>{l.actorRole}</Pill>
                  </td>
                  <td className={tdClass}>{l.action}</td>
                  <td className={tdClass}>
                    {l.clubId ? (
                      <Link href={`/admin/clubs/${l.clubId}`} className="text-brand underline">
                        {l.clubName}
                      </Link>
                    ) : null}
                    {l.courseName ? <span className="block text-muted">{l.courseName}</span> : null}
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
