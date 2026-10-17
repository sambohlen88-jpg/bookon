import type { Metadata } from "next";
import Link from "next/link";
import { alertByManageToken, listSearchableCourses } from "@bookon/db";
import { changeAlertByToken } from "@/app/actions";
import { AlertSummary } from "@/components/alert-summary";
import { SiteHeader } from "@/components/site-header";
import { secondaryButton } from "@/components/ui";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your alert · BookOn", robots: { index: false } };

/** Linked from every alert email, so golfers can pause or stop it without signing in. */
export default async function ManageAlertPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const alert = await alertByManageToken(db, token);
  const courseNames = new Map((await listSearchableCourses(db)).map((c) => [c.slug, c.name]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">Your alert</h1>
        {!alert || alert.status === "deleted" ? (
          <p className="mt-4">
            This alert has been deleted. You won&apos;t get any more emails about it.{" "}
            <Link href="/" className="text-brand underline">
              Search for a tee time
            </Link>
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border p-4">
            <AlertSummary alert={alert} courseNames={courseNames} />
            {alert.status === "ended" ? (
              <p className="text-sm text-muted">
                This alert has ended because its dates have passed.
              </p>
            ) : (
              <div className="flex gap-2">
                <form action={changeAlertByToken}>
                  <input type="hidden" name="token" value={token} />
                  <input
                    type="hidden"
                    name="status"
                    value={alert.status === "paused" ? "active" : "paused"}
                  />
                  <button type="submit" className={secondaryButton}>
                    {alert.status === "paused" ? "Turn back on" : "Pause emails"}
                  </button>
                </form>
                <form action={changeAlertByToken}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="status" value="deleted" />
                  <button type="submit" className={secondaryButton}>
                    Stop and delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
