import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@bookon/db";
import { requestSignIn } from "@/app/actions";
import { NewsletterTick } from "@/components/newsletter-tick";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton, textInput } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · BookOn" };

const ERRORS: Record<string, string> = {
  email: "That doesn't look like an email address. Check it and try again.",
  limit:
    "We've sent a few links to that address already. Use the latest one, or try again in an hour.",
  expired: "That link has expired or was already used. Ask for a new one below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { sent, error, next, reason } = await searchParams;
  const nextPath = safeNextPath(next) ?? "";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:mt-12 md:rounded-2xl md:border md:border-border md:p-10">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        {sent ? (
          <div className="mt-4 flex flex-col gap-3">
            <p>
              Check your email. We&apos;ve sent a sign-in link to <strong>{sent}</strong>.
            </p>
            <p className="text-sm text-muted">
              It works once and expires in 15 minutes. You can close this page.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <Notice tone="info">
                Developing locally? The email is at{" "}
                <a href="/dev/outbox" className="underline">
                  /dev/outbox
                </a>
                .
              </Notice>
            )}
          </div>
        ) : (
          <>
            <p className="mt-2 text-muted">
              No password needed. We&apos;ll email you a link. New here? The same link sets up your
              account.
            </p>
            <p className="mt-2 text-sm text-muted">
              An account lets you save favourite courses, get alerts when tee times open up, and see
              times you&apos;ve looked at. See our{" "}
              <Link href="/privacy" className="text-brand underline">
                privacy policy
              </Link>
              .
            </p>
            {reason === "admin" && (
              <div className="mt-4">
                <Notice tone="info">
                  For safety, the admin area asks you to sign in again every 12 hours.
                </Notice>
              </div>
            )}
            {error && ERRORS[error] && (
              <div className="mt-4">
                <Notice tone="warning">{ERRORS[error]}</Notice>
              </div>
            )}
            <form action={requestSignIn} className="mt-6 flex flex-col gap-4">
              <input type="hidden" name="next" value={nextPath} />
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className={textInput}
                />
              </div>
              <NewsletterTick />
              <button type="submit" className={primaryButton}>
                Email me a sign-in link
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
