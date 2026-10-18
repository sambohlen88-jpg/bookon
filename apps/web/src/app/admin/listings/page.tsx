import Link from "next/link";
import { listClubApplications, type ClubApplicationStatus } from "@bookon/db";
import { PageTitle, Pill, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

const TABS: { status: ClubApplicationStatus; label: string }[] = [
  { status: "submitted", label: "Waiting" },
  { status: "approved", label: "Approved" },
  { status: "declined", label: "Declined" },
  { status: "draft", label: "Being filled in" },
];

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { status = "submitted" } = await searchParams;
  const tab = TABS.find((t) => t.status === status) ?? TABS[0]!;
  const listings = await listClubApplications(getDb(), [tab.status]);
  return (
    <>
      <PageTitle title="Join requests" intro="Clubs that have asked to be listed on BookOn." />
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/listings?status=${t.status}`}
            aria-current={t.status === tab.status ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${t.status === tab.status ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {listings.length === 0 ? (
        <p className="text-muted">Nothing here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Club</th>
                <th className={thClass}>Contact</th>
                <th className={thClass}>{tab.status === "draft" ? "Last saved" : "Sent"}</th>
                <th className={thClass}>Payments?</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td className={tdClass}>
                    <Link
                      href={`/admin/listings/${l.id}`}
                      className="font-medium text-brand underline"
                    >
                      {l.clubName}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {l.contactName}
                    <span className="block text-muted">{l.contactEmail}</span>
                  </td>
                  <td className={tdClass}>
                    {(l.submittedAt ?? l.updatedAt).toLocaleDateString("en-AU", {
                      timeZone: "Australia/Perth",
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className={tdClass}>
                    {l.paymentsInterest ? (
                      <Pill tone={l.paymentsInterest === "yes" ? "good" : "muted"}>
                        {l.paymentsInterest}
                      </Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
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
