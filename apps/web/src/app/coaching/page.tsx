import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "For golf coaches · BookOn",
  description:
    "List your golf lessons on BookOn for free. Perth golfers see when you teach and message you directly to book.",
};

const card = "rounded-xl border border-border p-6";

export default async function CoachingPage() {
  const user = await currentUser();
  const start = user ? "/coach" : "/signin?next=/coach";
  return (
    <>
      <SiteHeader />
      <main className="pb-24">
        <section className="bg-hero-bg text-hero-fg">
          <div className="mx-auto max-w-md px-4 pb-16 pt-12 md:max-w-6xl md:px-6 md:pb-24 md:pt-20">
            <p className="text-sm font-semibold uppercase tracking-wide text-hero-muted">
              For golf coaches
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              Fill your lesson book with Perth golfers.
            </h1>
            <p className="mt-4 max-w-2xl text-hero-muted md:text-lg">
              Golfers already use BookOn to find tee times. List your coaching and they&apos;ll see
              when you teach, what you charge and where, then message you to book. Listing is free.
            </p>
            <Link
              href={start}
              className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-hero-fg px-5 font-semibold text-hero-bg"
            >
              List your coaching
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-md px-4 py-12 md:max-w-6xl md:px-6 md:py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-6">
            <div className={card}>
              <h3 className="text-lg font-semibold">1. Sign in and fill it in</h3>
              <p className="mt-2 text-muted">
                Sign in with your email, then add your rates, usual teaching hours, where you teach,
                what you specialise in and how golfers reach you.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">2. We check it</h3>
              <p className="mt-2 text-muted">
                BookOn checks every listing, including your PGA membership, usually within a week.
                Later changes are checked the same way.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">3. Golfers book you</h3>
              <p className="mt-2 text-muted">
                Golfers message you on WhatsApp, email or call. Or set up payments with Stripe and
                they can book and pay on BookOn: you accept each request and keep your full lesson
                price.
              </p>
            </div>
          </div>
          <Link href={start} className={`${primaryButton} mt-8`}>
            {user ? "Open my listing" : "Sign in to start"}
          </Link>
        </section>
      </main>
    </>
  );
}
