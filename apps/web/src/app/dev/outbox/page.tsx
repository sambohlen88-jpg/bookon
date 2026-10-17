import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listOutboxEmails } from "@bookon/db";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Outbox · BookOn", robots: { index: false } };

/** Development only: emails BookOn would have sent. Never shown in production. */
export default async function OutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const emails = await listOutboxEmails(getDb(), 30);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">Outbox</h1>
        <p className="mt-1 text-sm text-muted">
          Emails BookOn would have sent. Real email starts when Postmark is set up. Newest first.
        </p>
        {emails.length === 0 && <p className="mt-6">Nothing yet.</p>}
        {emails.map((e) => (
          <article key={e.id} className="mt-6 rounded-xl border border-border">
            <header className="border-b border-border px-4 py-3 text-sm">
              <p className="font-semibold">{e.subject}</p>
              <p className="text-muted">
                To {e.to} · {e.createdAt.toLocaleString("en-AU", { timeZone: "Australia/Perth" })}
              </p>
            </header>
            <iframe
              title={e.subject}
              srcDoc={e.html}
              sandbox="allow-top-navigation-by-user-activation allow-popups"
              className="h-96 w-full"
            />
          </article>
        ))}
      </main>
    </>
  );
}
