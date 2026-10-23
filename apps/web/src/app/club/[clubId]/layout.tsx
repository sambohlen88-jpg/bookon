import type { Metadata } from "next";
import { AreaNav } from "@/components/admin/nav";
import { SiteHeader } from "@/components/site-header";
import { requireClub } from "@/lib/access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your club · BookOn", robots: { index: false } };

/** Every club page and action also checks access itself; this only draws the frame. */
export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const { club, admin } = await requireClub(clubId, `/club/${clubId}`);
  const base = `/club/${club.id}`;
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <div className="mx-auto max-w-md px-4 pb-12 pt-6 md:grid md:max-w-6xl md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:px-6 md:pt-10">
        <div className="mb-6 md:mb-0 print:hidden">
          <p className="mb-2 px-3 font-semibold">{club.name}</p>
          {admin && (
            <p className="mb-2 px-3 text-xs text-muted">You&apos;re seeing this as an admin.</p>
          )}
          <AreaNav
            label="Your club"
            links={[
              { href: base, label: "Overview", exact: true },
              { href: `${base}/details`, label: "Details" },
              { href: `${base}/prices`, label: "Prices" },
              { href: `${base}/events`, label: "Events" },
              { href: `${base}/payments`, label: "Payments" },
              { href: `${base}/photos`, label: "Photos" },
              { href: `${base}/reports`, label: "Reports" },
              { href: `${base}/team`, label: "Team" },
            ]}
          />
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
