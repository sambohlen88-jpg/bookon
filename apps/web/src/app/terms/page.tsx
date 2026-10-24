import type { Metadata } from "next";
import Link from "next/link";
import { businessDetails } from "@bookon/db";
import { CONTACT_EMAIL, LegalSection, TERMS_UPDATED, whoWeAre } from "@/components/legal";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Terms of use · BookOn",
  description: "The rules for using BookOn: tee times, lessons, events, ratings and news.",
};

/** The terms of use (Milestone 24). A draft for a lawyer to review before launch. */
export default async function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms of use</h1>
        <p className="mt-2 text-muted">Last updated {TERMS_UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">
          These terms are between you and {who}. By using bookon.com.au or the BookOn app, you agree
          to them. They&apos;re written to be read; if anything&apos;s unclear, email {mail}.
        </p>

        <LegalSection id="what" title="What BookOn is">
          <p>
            BookOn helps you find free tee times at golf courses, simulators and driving ranges in
            Western Australia, and book lessons and club competitions.
          </p>
          <ul>
            <li>
              <strong>Tee times are booked with the club, not with BookOn.</strong> When you choose
              a time, we send you to the club&apos;s own booking page, and the club&apos;s terms
              apply.
            </li>
            <li>
              Times and prices come from each club&apos;s booking page when we last checked. They
              can change, and a time can be taken by someone else before you book. The club&apos;s
              own page is always right.
            </li>
            <li>BookOn isn&apos;t run by, or speaking for, any club unless we say so.</li>
          </ul>
        </LegalSection>

        <LegalSection id="accounts" title="Your account">
          <ul>
            <li>You sign in with a link sent to your email. Keep your email account secure.</li>
            <li>Give us true details, especially when booking or entering something.</li>
            <li>
              You can delete your account at any time from{" "}
              <Link href="/account" className="text-brand underline">
                My account
              </Link>
              .
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="lessons" title="Lessons and group sessions">
          <ul>
            <li>
              Lessons are between you and the coach. The coach is responsible for the lesson itself;
              BookOn takes the booking and payment.
            </li>
            <li>
              The price, booking fee, and cancellation and refund rules are shown before you pay,
              and those are the rules that apply to your booking.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="competitions" title="Club events and match play">
          <ul>
            <li>
              The club runs its events and competitions, sets the rules, and has the final say on
              start sheets, draws and results.
            </li>
            <li>
              The entry fee, booking fee and refund rules are shown before you enter, and those
              apply.
            </li>
            <li>
              In match play, you agree to your contact details going to your opponents, so you can
              arrange your matches. Use them only for that.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="content" title="Ratings, news and what you post">
          <ul>
            <li>
              Rate courses you&apos;ve played, honestly. Don&apos;t rate your own club or a club you
              work for.
            </li>
            <li>
              If you write news or add pictures, you confirm they&apos;re yours to share (or you
              have permission), and you let BookOn publish, edit for length and clarity, and share
              them on BookOn and our social accounts. You keep the copyright.
            </li>
            <li>
              We can remove ratings, articles, listings or pictures that break these terms, or the
              law.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="use" title="Using BookOn fairly">
          <p>Please don&apos;t:</p>
          <ul>
            <li>copy BookOn&apos;s data with scripts or bots, or overload the site</li>
            <li>try to get into accounts or areas that aren&apos;t yours</li>
            <li>
              use other people&apos;s details, or misuse contact details you get through BookOn
            </li>
            <li>post anything misleading, offensive or unlawful.</li>
          </ul>
          <p>We can suspend accounts that do these things.</p>
        </LegalSection>

        <LegalSection id="law" title="Your rights and our responsibility">
          <ul>
            <li>
              Nothing in these terms takes away your rights under the Australian Consumer Law,
              including guarantees that can&apos;t be excluded.
            </li>
            <li>
              We work hard to keep BookOn accurate and running, but can&apos;t promise it will
              always be available or that every time and price is right. Check with the club before
              you rely on it.
            </li>
            <li>
              As far as the law allows, BookOn isn&apos;t responsible for what clubs, coaches or
              other golfers do, or for losses caused by information from a club&apos;s booking page.
            </li>
            <li>These terms are governed by the law of Western Australia.</li>
          </ul>
        </LegalSection>

        <LegalSection id="changes" title="Changes and contact">
          <p>
            We may update these terms as BookOn changes, and will change the date at the top. If we
            make a big change, we&apos;ll tell account holders by email first.
          </p>
          <p>
            {who}, Perth, Western Australia. Email {mail}. See also our{" "}
            <Link href="/privacy" className="text-brand underline">
              privacy policy
            </Link>
            .
          </p>
        </LegalSection>
      </main>
    </>
  );
}
