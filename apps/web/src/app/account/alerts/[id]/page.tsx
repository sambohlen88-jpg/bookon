import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { alertFilters, alertForUser } from "@bookon/db";
import { saveAlert } from "@/app/account/alerts/actions";
import { AlertForm } from "@/components/alert-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth";
import { alertValues } from "@/lib/alert-form";
import { alertFormData } from "@/lib/alert-form-page";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit alert · BookOn", robots: { index: false } };

/** Change one of the golfer's alerts (Milestone 28). */
export default async function EditAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent("/account?tab=alerts")}`);
  const db = getDb();
  const alert = /^[0-9a-f-]{36}$/.test(id) ? await alertForUser(db, id, user!.id) : null;
  if (!alert) notFound();
  const now = new Date();
  const { courses, options } = await alertFormData(db, now);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-16 pt-6 md:max-w-xl md:px-6 md:pt-12">
        <Link href="/account?tab=alerts" className="text-sm font-medium text-brand">
          ← My alerts
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Edit alert</h1>
        {alert!.status === "ended" && (
          <p className="mt-2 text-muted">
            This alert has ended. Pick a new day and save to start it again.
          </p>
        )}
        <div className="mt-6">
          <AlertForm
            action={saveAlert}
            values={alertValues(alertFilters(alert!), now)}
            courses={courses}
            options={options}
            alertId={alert!.id}
            submitLabel="Save changes"
          />
        </div>
      </main>
    </>
  );
}
