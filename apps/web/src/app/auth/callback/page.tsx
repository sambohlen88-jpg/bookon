import type { Metadata } from "next";
import Link from "next/link";
import { completeSignIn } from "@/app/actions";
import { SiteHeader } from "@/components/site-header";
import { primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · BookOn", robots: { index: false } };

/**
 * The link in the email lands here and asks for one tap. Signing in on a
 * button press, not on page load, stops email scanners that open links
 * from using up the one-time link.
 */
export default async function SignInCallback({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:mt-12 md:rounded-2xl md:border md:border-border md:p-10">
        <h1 className="text-3xl font-bold tracking-tight">Sign in to BookOn</h1>
        {token ? (
          <form action={completeSignIn} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={`${primaryButton} w-full`}>
              Sign in
            </button>
          </form>
        ) : (
          <p className="mt-4">
            This link is missing something.{" "}
            <Link href="/signin" className="text-brand underline">
              Ask for a new one
            </Link>
            .
          </p>
        )}
      </main>
    </>
  );
}
