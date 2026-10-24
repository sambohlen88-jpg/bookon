import Link from "next/link";
import { formatPerthDay, formatPrice, perthDate } from "@bookon/core";
import { listCompsForAdmin } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";
import { COMP_STATUS } from "@/lib/matchplay";

/** Match play competitions (Milestone 22) at every club. */
export default async function AdminMatchplay() {
  await requireAdmin();
  const comps = await listCompsForAdmin(getDb(), new Date());
  return (
    <>
      <PageTitle
        title="Match play"
        intro="Knockout competitions clubs run on BookOn. Entry fees go straight to each club; BookOn takes the booking fee on paid entries."
      />
      {comps.length === 0 ? (
        <p className="text-muted">No match play competitions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Competition</th>
                <th className={thClass}>Club</th>
                <th className={thClass}>Set up</th>
                <th className={`${thClass} text-right`}>Entries</th>
                <th className={`${thClass} text-right`}>Fee</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    <Link href={`/club/${c.clubId}/matchplay/${c.id}`} className="text-brand">
                      {c.title}
                    </Link>
                    <span className="block text-muted">
                      {c.teamSize === 2 ? "Pairs" : "Singles"}
                      {c.open ? "" : " · members only"}
                    </span>
                  </td>
                  <td className={tdClass}>{c.clubName}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatPerthDay(perthDate(c.createdAt))}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {c.entered} of {c.maxEntries}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {c.feeCents > 0 ? formatPrice(c.feeCents) : "Free"}
                  </td>
                  <td className={tdClass}>
                    <Pill
                      tone={c.status === "cancelled" || c.status === "finished" ? "muted" : "good"}
                    >
                      {COMP_STATUS[c.status]}
                    </Pill>
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
