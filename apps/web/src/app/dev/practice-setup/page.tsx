import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { safeNextPath } from "@bookon/db";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";
import { lessonPayments } from "@/lib/lessons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Practice payment setup · BookOn",
  robots: { index: false },
};

/** Stands in for Stripe's account setup and dashboard on a local database with no Stripe keys. */
export default async function PracticeSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if ((await lessonPayments())?.kind !== "practice") notFound();
  const query = await searchParams;
  // Only ever back to this site's coach page.
  const back = safeNextPath(query.return) ?? "/coach";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <p className="inline-block rounded-full bg-warning-bg px-3 py-1 text-sm font-semibold text-warning-fg">
          Practice: no money moves
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {query.dashboard ? "Stripe dashboard" : "Payment setup"}
        </h1>
        <p className="mt-2">
          {query.dashboard
            ? "On the real site, this opens the coach's Stripe dashboard: their payments, payouts to their bank, and receipts."
            : "On the real site, Stripe asks the coach for their name, date of birth, address, ABN (if they have one), a photo of their ID and their bank account. BookOn never sees any of it."}
        </p>
        <Link href={back} className={`${primaryButton} mt-6 w-full`}>
          {query.dashboard ? "Back to My coaching" : "Finish setup (practice)"}
        </Link>
      </main>
    </>
  );
}
