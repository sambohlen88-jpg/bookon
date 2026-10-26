import Link from "next/link";
import type { BusinessDetails } from "@bookon/db";

/** Shared pieces of the privacy policy and terms (Milestone 24). */

export const PRIVACY_UPDATED = "26 October 2026";
export const TERMS_UPDATED = "24 October 2026";
export const CONTACT_EMAIL = "info@bookon.au";

/** Who runs BookOn, from Admin, Settings once the business is registered. */
export function whoWeAre(business: BusinessDetails): string {
  if (!business.name) return "BookOn";
  return `${business.name}${business.abn ? ` (ABN ${business.abn})` : ""}, trading as BookOn`;
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-4">
      <h2 id={`${id}-h`} className="mt-10 text-2xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

/** A small line by forms that collect details. */
export function PrivacyNote() {
  return (
    <p className="text-sm text-muted">
      How we look after your details:{" "}
      <Link href="/privacy" className="text-brand underline">
        privacy policy
      </Link>
      .
    </p>
  );
}
