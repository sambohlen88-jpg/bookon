import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clubsForEmail } from "@bookon/db";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your club · BookOn", robots: { index: false } };

/** Where club staff land after signing in: straight to their club, or a choice. */
export default async function ClubHome() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/club");
  const clubs = await clubsForEmail(getDb(), user.email);
  if (clubs.length === 1) redirect(`/club/${clubs[0]!.id}`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:max-w-2xl md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight">Your club</h1>
        {clubs.length === 0 ? (
          <>
            <p className="mt-3 text-muted">
              {user.email} isn&apos;t linked to a club on BookOn. If your club is listed, ask its
              owner to add you, or email info@bookon.au.
            </p>
            <Link href="/clubs/join" className={`${primaryButton} mt-6`}>
              List your club
            </Link>
          </>
        ) : (
          <ul className="mt-6 rounded-xl border border-border">
            {clubs.map((c) => (
              <li key={c.id} className="border-t border-border first:border-t-0">
                <Link
                  href={`/club/${c.id}`}
                  className="flex min-h-14 items-center justify-between px-4 font-medium hover:text-brand"
                >
                  {c.name}
                  <span className="text-sm text-muted">{c.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
