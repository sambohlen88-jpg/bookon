import type { Metadata } from "next";
import { startClubListing } from "@/app/clubs/actions";
import { Field } from "@/components/form";
import { SiteHeader } from "@/components/site-header";
import { Notice, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List your club · BookOn", robots: { index: false } };

const ERRORS: Record<string, string> = {
  missing: "Add your club's name, your name and your email.",
  limit:
    "That email has started a few listings today. Use the link we emailed you, or try tomorrow.",
  link: "That link doesn't work. Check you copied all of it, or start again below.",
  check: "Something went wrong. Try again.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pb-12 pt-6 md:mt-12 md:max-w-xl md:rounded-2xl md:border md:border-border md:p-10">
        <h1 className="text-3xl font-bold tracking-tight">List your club</h1>
        <p className="mt-2 text-muted">
          Start with the basics. We&apos;ll email you a private link so you, or someone else at the
          club, can finish it later.
        </p>
        {error && ERRORS[error] && (
          <div className="mt-4">
            <Notice tone="warning">{ERRORS[error]}</Notice>
          </div>
        )}
        <form action={startClubListing} className="mt-6 flex flex-col gap-4">
          <Field label="Club name" name="clubName" required autoComplete="organization" />
          <Field label="Suburb or town" name="suburb" required />
          <Field label="Your name" name="contactName" required autoComplete="name" />
          <Field
            label="Your email"
            name="contactEmail"
            type="email"
            required
            autoComplete="email"
            hint="We'll send your private link here."
          />
          {/* Left empty by people; bots fill it in. */}
          <div aria-hidden="true" className="hidden">
            <label>
              Website <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <button type="submit" className={primaryButton}>
            Start
          </button>
        </form>
      </main>
    </>
  );
}
