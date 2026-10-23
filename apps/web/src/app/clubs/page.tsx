import type { Metadata } from "next";
import Link from "next/link";
import { CourseArt } from "@/components/course-art";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "For golf clubs · BookOn",
  description:
    "List your club on BookOn for free. Golfers find your tee times and book with you, on your own booking page.",
};

const card = "rounded-xl border border-border p-6";

export default function ClubsPage() {
  return (
    <>
      <SiteHeader />
      <main className="pb-12">
        <section className="relative overflow-hidden bg-hero-bg text-hero-fg">
          <div className="relative z-10 mx-auto max-w-md px-4 pb-40 pt-12 md:max-w-6xl md:px-6 md:pb-60 md:pt-20">
            <p className="text-sm font-semibold uppercase tracking-wide text-hero-muted">
              For golf clubs
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              More golfers finding your empty tee times.
            </h1>
            <p className="mt-4 max-w-2xl text-hero-muted md:text-lg">
              BookOn shows Perth and WA golfers every free public tee time in one search, then sends
              them to your booking page to book and pay. Listing is free.
            </p>
            <Link
              href="/clubs/join"
              className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-hero-fg px-5 font-semibold text-hero-bg"
            >
              List your club
            </Link>
          </div>
          <CourseArt
            slug="bookon-clubs"
            wide
            eager
            className="absolute inset-x-0 bottom-0 h-28 w-full md:h-44"
          />
        </section>

        <section className="mx-auto max-w-md px-4 py-12 md:max-w-6xl md:px-6 md:py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">What you get</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-6">
            <div className={card}>
              <h3 className="text-lg font-semibold">Golfers who wouldn&apos;t have found you</h3>
              <p className="mt-2 text-muted">
                Golfers search by day and time across every course, so your free times show up next
                to the big names.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">Cancellations filled</h3>
              <p className="mt-2 text-muted">
                Golfers set alerts for times they want. When one frees up at your course, they hear
                about it by email or on their phone, straight away.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">Bookings stay yours</h3>
              <p className="mt-2 text-muted">
                Golfers book and pay on your own booking page. We never take a booking or a fee, and
                we send you a monthly report of the golfers we sent.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-md px-4 pb-12 md:max-w-6xl md:px-6 md:pb-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Run your events on BookOn
          </h2>
          <p className="mt-2 max-w-3xl text-muted">
            Competitions and social days, without the spreadsheet. Nothing here touches handicaps.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-6">
            <div className={card}>
              <h3 className="text-lg font-semibold">Entries paid up front</h3>
              <p className="mt-2 text-muted">
                Golfers enter on their own or as a team and pay online. Entry fees go straight to
                the club&apos;s bank account through Stripe, with members&apos; prices if you like.
                Full events get a waiting list.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">Start sheet in a few taps</h3>
              <p className="mt-2 text-muted">
                BookOn sets out groups of four, keeping teams together, for tee times or a shotgun.
                Move anyone you need to, publish, and everyone gets their time by email. Print it or
                download it.
              </p>
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold">Golfers find your open days</h3>
              <p className="mt-2 text-muted">
                Open events are listed on BookOn&apos;s Competitions page, your course page and the
                home page. Members-only events stay unlisted and are shared by link.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            The club keeps its full entry fees. Golfers pay BookOn a small booking fee per entry.
            Withdrawals before entries close are refunded automatically.
          </p>
        </section>

        <section className="bg-surface">
          <div className="mx-auto grid max-w-md gap-8 px-4 py-12 md:max-w-6xl md:grid-cols-2 md:gap-16 md:px-6 md:py-16">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">How listing works</h2>
              <ol className="mt-6 flex flex-col gap-4">
                {[
                  [
                    "Tell us about your club",
                    "Your courses, how you take bookings, your tee times and prices. About 15 minutes; you can stop and come back.",
                  ],
                  [
                    "Give your approvals",
                    "That we may show your times and prices and read your public booking page.",
                  ],
                  [
                    "We set you up",
                    "We check the details, connect to your booking page and email you when you're live, usually within a week.",
                  ],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="text-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Have these handy</h2>
              <ul className="mt-6 flex flex-col gap-2 text-muted">
                <li>• Your ABN and a contact for bookings and accounts</li>
                <li>• Your booking system and booking page address</li>
                <li>
                  • Tee time intervals, first and last times, and how far ahead golfers can book
                </li>
                <li>
                  • Your price list: green fees (midweek, weekend, twilight, seniors, juniors),
                  carts, club hire, trolleys and any deals
                </li>
                <li>• A few photos of the course you&apos;re happy for us to use</li>
              </ul>
              <p className="mt-6 text-sm text-muted">
                Planning ahead: we ask for your full price list and accounts contact now, so taking
                bookings and payments through BookOn is easy to switch on later, if you want it.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-md px-4 py-12 text-center md:max-w-6xl md:px-6 md:py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ready to list your club?
          </h2>
          <p className="mt-2 text-muted">
            Free to list. Questions? Email{" "}
            <a href="mailto:info@bookon.com.au" className="text-brand underline">
              info@bookon.com.au
            </a>
            .
          </p>
          <Link href="/clubs/join" className={`${primaryButton} mt-6`}>
            List your club
          </Link>
        </section>
      </main>
    </>
  );
}
