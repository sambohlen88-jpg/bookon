import Link from "next/link";
import { formatPerthDay, perthDate } from "@bookon/core";
import { compsForClub } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { primaryButton } from "@/components/ui";
import { requireClub } from "@/lib/access";
import { getDb } from "@/lib/db";
import { COMP_STATUS } from "@/lib/matchplay";

/** A club's match play competitions (Milestone 22). */
export default async function ClubMatchplay({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const { club } = await requireClub(clubId, `/club/${clubId}/matchplay`);
  const comps = await compsForClub(getDb(), club.id, new Date());

  return (
    <>
      <PageTitle
        title="Match play"
        intro="Knockout competitions, singles or pairs. Players arrange their own matches by a date you set and report the results; you have the final say. Nothing here uses handicaps."
      />
      <Link href={`/club/${club.id}/matchplay/new`} className={`${primaryButton} mb-6`}>
        Set up a competition
      </Link>
      {comps.length === 0 ? (
        <p className="text-muted">No match play competitions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Competition</th>
                <th className={`${thClass} text-right`}>Entries</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    <Link
                      href={`/club/${club.id}/matchplay/${c.id}`}
                      className="font-medium text-brand"
                    >
                      {c.title}
                    </Link>
                    <span className="block text-muted">
                      {c.teamSize === 2 ? "Pairs" : "Singles"} · {c.courseName}
                      {c.open ? "" : " · members only"}
                      {c.status === "entries" && c.entriesClose
                        ? ` · entries close ${formatPerthDay(perthDate(c.entriesClose))}`
                        : ""}
                    </span>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {c.entered} of {c.maxEntries}
                  </td>
                  <td className={tdClass}>
                    <Pill
                      tone={
                        c.status === "cancelled" || c.status === "finished"
                          ? "muted"
                          : c.status === "drawn"
                            ? "warn"
                            : "good"
                      }
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
