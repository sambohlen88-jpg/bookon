import type { Metadata } from "next";
import Link from "next/link";
import { ANALYTICS_KEEP_MONTHS } from "@bookon/core";
import { businessDetails } from "@bookon/db";
import { CONTACT_EMAIL, LegalSection, PRIVACY_UPDATED, whoWeAre } from "@/components/legal";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Privacy policy · BookOn",
  description: "What BookOn collects, why, who sees it, and how to change or delete it.",
};

const contents: [string, string][] = [
  ["short", "The short version"],
  ["collect", "What we collect, and why"],
  ["cookies", "Cookies and your browser"],
  ["share", "Who we share it with"],
  ["overseas", "Outside Australia"],
  ["emails", "Emails and notifications"],
  ["keep", "How long we keep it"],
  ["rights", "Seeing, changing or deleting your details"],
  ["security", "Keeping it safe"],
  ["changes", "Changes and contact"],
];

/** The privacy policy (Milestone 24). A draft for a lawyer to review before launch. */
export default async function PrivacyPage() {
  const business = await businessDetails(getDb()).catch(() => ({}));
  const who = whoWeAre(business);
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-6 md:pt-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy policy</h1>
        <p className="mt-2 text-muted">Last updated {PRIVACY_UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">
          This policy explains how {who} (&ldquo;BookOn&rdquo;, &ldquo;we&rdquo;) handles personal
          information when you use bookon.com.au and the BookOn app. We follow the Australian
          Privacy Principles in the Privacy Act 1988. Questions? Email {mail}.
        </p>
        <nav aria-label="Contents" className="mt-6 rounded-xl bg-surface p-4">
          <p className="font-semibold">Contents</p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {contents.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-brand">
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <LegalSection id="short" title="The short version">
          <ul>
            <li>You can search for tee times without an account or giving us any details.</li>
            <li>We never sell your details, and we don&apos;t use advertising trackers.</li>
            <li>
              When you book or enter something through BookOn, we share your details with the coach,
              club or opponent involved, and tell you before you do.
            </li>
            <li>Card payments are handled by Stripe. We never see your card number.</li>
            <li>
              We count how people use BookOn to make it better, with our own tools. We don&apos;t
              keep IP addresses for this.
            </li>
            <li>You can delete your account at any time from My account.</li>
          </ul>
        </LegalSection>

        <LegalSection id="collect" title="What we collect, and why">
          <h3 className="font-semibold">When you look around</h3>
          <ul>
            <li>
              <strong>An anonymous visitor number</strong>, kept in a cookie, so we can tell one
              visit from the next. It isn&apos;t linked to your name or email.
            </li>
            <li>
              <strong>The searches you run</strong> (dates, times, players, courses) and{" "}
              <strong>the tee times you click through to</strong> a club. We use these to improve
              BookOn and, as totals that don&apos;t identify anyone, to show clubs how many golfers
              BookOn sends them.
            </li>
            <li>
              <strong>How you use the site:</strong> the pages you open, how long they&apos;re on
              screen, the site or link you came from, your type of device and browser, a rough
              location (city or region) from our website host, and how quickly pages load. If your
              browser asks not to be tracked (&ldquo;Do Not Track&rdquo; or Global Privacy Control),
              we don&apos;t record these.
            </li>
            <li>
              <strong>Near me:</strong> if you use it, your phone&apos;s location is rounded to
              about a kilometre and used for that search only. We don&apos;t save it.
            </li>
          </ul>
          <h3 className="mt-2 font-semibold">With an account</h3>
          <ul>
            <li>
              Your <strong>email address</strong>, to sign you in with a link (there&apos;s no
              password).
            </li>
            <li>
              Your <strong>favourite courses</strong>, <strong>tee time alerts</strong>,{" "}
              <strong>course ratings</strong> and the{" "}
              <strong>tee times you&apos;ve looked at</strong>, so you can see them again.
            </li>
            <li>
              If you turn on <strong>phone notifications</strong>, the address your browser gives us
              to send them.
            </li>
          </ul>
          <h3 className="mt-2 font-semibold">When you book or enter</h3>
          <ul>
            <li>
              <strong>Lessons and group sessions:</strong> your name, email, mobile and any note go
              to the coach, and so does where you&apos;d like the lesson when the coach comes to
              you.
            </li>
            <li>
              <strong>Club events:</strong> the players&apos; names and any member numbers, your
              email and mobile go to the club. Once the club publishes the start sheet,
              players&apos; names show on the event page.
            </li>
            <li>
              <strong>Match play:</strong> names, email and mobile go to the club, and to each
              opponent by email, so you can arrange your matches. Names and results show on the
              public draw sheet. Contact details never do.
            </li>
            <li>
              <strong>Payments:</strong> Stripe collects your card details and processes the
              payment. We keep a record of what was paid, refunded and when.
            </li>
          </ul>
          <h3 className="mt-2 font-semibold">Coaches, clubs and writers</h3>
          <ul>
            <li>
              <strong>Coaches:</strong> the details you put in your listing, including photos, are
              public. We count taps on your contact buttons to show you. If you link your calendar,
              we read only when you&apos;re busy (start and end times), not what the events are.
              Stripe collects the ID and bank details it needs to pay you; BookOn doesn&apos;t see
              them.
            </li>
            <li>
              <strong>Clubs:</strong> your club&apos;s details, and the emails of people on your
              club&apos;s team.
            </li>
            <li>
              <strong>News authors:</strong> your name, a short bio, your articles, and pictures you
              upload. We remove hidden details from pictures, like where they were taken.
            </li>
          </ul>
          <p>
            And if you email us, we keep the conversation so we can help. We only collect what we
            need for these things. You don&apos;t have to give us your details, but we can&apos;t
            make a booking or entry without them.
          </p>
        </LegalSection>

        <LegalSection id="cookies" title="Cookies and your browser">
          <ul>
            <li>
              <strong>bookon_sid</strong>: the anonymous visitor number. Lasts a year.
            </li>
            <li>
              <strong>bookon_auth</strong>: keeps you signed in. Lasts up to 90 days, or until you
              sign out.
            </li>
            <li>
              Your browser also remembers your <strong>recent searches</strong> and whether
              you&apos;ve closed the &ldquo;add to home screen&rdquo; message. These stay on your
              device and aren&apos;t sent to us.
            </li>
          </ul>
          <p>
            We don&apos;t use advertising cookies or trackers from other companies. You can clear
            cookies in your browser at any time; you&apos;ll just need to sign in again.
          </p>
        </LegalSection>

        <LegalSection id="share" title="Who we share it with">
          <p>We never sell or rent your details. We share them only:</p>
          <ul>
            <li>
              <strong>With the coach, club or opponent</strong> your booking or entry is with, as
              described above.
            </li>
            <li>
              <strong>When you click through to a club&apos;s booking page</strong>, you&apos;re on
              the club&apos;s website (or its booking system), and its privacy policy applies to
              what you give it.
            </li>
            <li>
              <strong>With companies that help us run BookOn</strong>, only as much as they need:
              Stripe (payments), our email service (sending emails), our website and database hosts,
              and the services that deliver phone notifications (such as Apple, Google and Mozilla).
            </li>
            <li>
              <strong>If the law requires it</strong>, or to protect someone&apos;s safety.
            </li>
          </ul>
          <p>
            Weather forecasts (MET Norway) and map locations (OpenStreetMap) are looked up for
            courses, not for you, so no personal details are sent to them.
          </p>
        </LegalSection>

        <LegalSection id="overseas" title="Outside Australia">
          <p>
            Some of the companies above store or handle information outside Australia, including in
            the United States and Europe. We choose providers that protect information to a standard
            similar to the Australian Privacy Principles.
          </p>
        </LegalSection>

        <LegalSection id="emails" title="Emails and notifications">
          <p>
            We email you about things you&apos;ve asked for: sign-in links, alerts, bookings,
            entries, and results. Every alert email has a link to stop it, and you can turn phone
            notifications off in My account or your browser. We won&apos;t send marketing emails
            unless you&apos;ve said yes.
          </p>
        </LegalSection>

        <LegalSection id="keep" title="How long we keep it">
          <ul>
            <li>Your account, favourites, alerts and ratings: until you delete your account.</li>
            <li>
              Page visits, actions and loading times: {ANALYTICS_KEEP_MONTHS} months, then deleted.
            </li>
            <li>Shared search links: deleted a week after the last day searched.</li>
            <li>
              Bookings, entries and payments: as long as the law requires (usually five years for
              tax records).
            </li>
            <li>
              Searches and clicks to clubs: linked only to the anonymous visitor number, and used in
              totals for clubs.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="rights" title="Seeing, changing or deleting your details">
          <ul>
            <li>
              <strong>See and change</strong> most of your details in{" "}
              <Link href="/account" className="text-brand underline">
                My account
              </Link>
              .
            </li>
            <li>
              <strong>Delete your account</strong> from My account. Your favourites, alerts and
              history are deleted; records of payments are kept as the law requires.
            </li>
            <li>
              <strong>Ask for a copy</strong> of what we hold about you, or for a correction, by
              emailing {mail}. We&apos;ll reply within 30 days.
            </li>
            <li>
              <strong>Complaints:</strong> email us first and we&apos;ll do our best to fix it. If
              you&apos;re not happy with our answer, you can contact the Office of the Australian
              Information Commissioner at{" "}
              <a href="https://www.oaic.gov.au" className="text-brand underline">
                oaic.gov.au
              </a>
              .
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="security" title="Keeping it safe">
          <p>
            BookOn uses secure connections (HTTPS) everywhere. Sign-in links work once and expire
            quickly, and we store only a scrambled version of them. Only the people who need to,
            such as the coach or club you booked with, can see your booking details. If something
            ever went wrong that put your details at serious risk, we&apos;d tell you and the
            Information Commissioner, as the law requires.
          </p>
        </LegalSection>

        <LegalSection id="changes" title="Changes and contact">
          <p>
            We&apos;ll update this policy as BookOn changes, and change the date at the top. If we
            make a big change, we&apos;ll tell account holders by email first.
          </p>
          <p>
            {who}, Perth, Western Australia. Email {mail}.
          </p>
          <p>
            See also our{" "}
            <Link href="/terms" className="text-brand underline">
              terms of use
            </Link>
            .
          </p>
        </LegalSection>
      </main>
    </>
  );
}
