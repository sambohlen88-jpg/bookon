import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addAlert } from "@/app/account/alerts/actions";
import { AlertForm } from "@/components/alert-form";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth";
import { newAlertValues } from "@/lib/alert-form";
import { alertFormData } from "@/lib/alert-form-page";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add an alert · BookOn", robots: { index: false } };

/** Add an alert (Milestone 28). A course page's bell opens this with its course picked. */
export default async function NewAlertPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { course: asked } = await searchParams;
  const here = `/account/alerts/new${asked ? `?course=${encodeURIComponent(asked)}` : ""}`;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(here)}`);
  const now = new Date();
  const { courses, options } = await alertFormData(getDb(), now);
  const course = courses.find((c) => c.slug === asked) ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-16 pt-6 md:max-w-xl md:px-6 md:pt-12">
        <Link href="/account?tab=alerts" className="text-sm font-medium text-brand">
          ← My alerts
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {course ? `Alert me at ${course.name}` : "Add an alert"}
        </h1>
        <p className="mt-2 text-muted">
          We&apos;ll check for new times and cancellations, and tell you when one matches.
        </p>
        <div className="mt-6">
          <AlertForm
            action={addAlert}
            values={newAlertValues(now, course?.slug ?? null)}
            courses={courses}
            options={options}
            submitLabel="Set up alert"
          />
        </div>
      </main>
    </>
  );
}
