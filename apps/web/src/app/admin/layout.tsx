import type { Metadata } from "next";
import { adminCounts } from "@bookon/db";
import { AreaNav } from "@/components/admin/nav";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · BookOn", robots: { index: false } };

/** Every admin page and action also checks access itself; this only draws the frame. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const counts = await adminCounts(getDb());
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-12 pt-6 md:grid md:max-w-6xl md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:px-6 md:pt-10">
        <div className="mb-6 md:mb-0">
          <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wide text-muted md:block">
            Admin
          </p>
          <AreaNav
            label="Admin"
            links={[
              { href: "/admin", label: "Overview", exact: true },
              { href: "/admin/listings", label: "Join requests", badge: counts.listings },
              { href: "/admin/photos", label: "Photos", badge: counts.photos },
              { href: "/admin/courses", label: "Courses" },
              { href: "/admin/clubs", label: "Clubs", badge: counts.changeRequests },
              { href: "/admin/coaches", label: "Coaches", badge: counts.coaches },
              { href: "/admin/reports", label: "Reports" },
              { href: "/admin/log", label: "Change log" },
              { href: "/admin/settings", label: "Settings" },
            ]}
          />
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </>
  );
}
