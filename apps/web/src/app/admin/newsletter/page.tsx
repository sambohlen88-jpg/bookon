import { formatPerthDay, perthDate } from "@bookon/core";
import {
  NEWSLETTER_CONSENT,
  NEWSLETTER_SOURCES,
  listNewsletterSubscribers,
  newsletterSummary,
} from "@bookon/db";
import { PageTitle, Pill, panel, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { Notice, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const sourceName = (source: string) =>
  NEWSLETTER_SOURCES[source as keyof typeof NEWSLETTER_SOURCES] ?? source;

/**
 * The newsletter list (Milestone 27): who's asked for BookOn news, from where,
 * and whether Mailchimp has them yet. Newsletters are written and sent in Mailchimp.
 */
export default async function AdminNewsletter() {
  await requireAdmin();
  const db = getDb();
  const summary = await newsletterSummary(db);
  const people = await listNewsletterSubscribers(db, 200);
  const connected = Boolean(process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID);

  return (
    <>
      <PageTitle
        title="Newsletter"
        intro="People who ticked “Send me BookOn news”. Write and send newsletters in Mailchimp; BookOn keeps the list, and each person's consent, up to date there."
      />
      {!connected && (
        <div className="mb-4">
          <Notice tone="info">
            Mailchimp isn&apos;t set up yet, so sign-ups are kept here and sent across once it is
            (set MAILCHIMP_API_KEY and MAILCHIMP_AUDIENCE_ID on the website and the worker).
          </Notice>
        </div>
      )}
      {summary.problems > 0 && (
        <div className="mb-4">
          <Notice tone="warning">
            {summary.problems === 1 ? "1 change" : `${summary.problems} changes`} couldn&apos;t be
            sent to Mailchimp. The worker tries again each pass; the reason is in the list below.
          </Notice>
        </div>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className={panel}>
          <p className="text-sm text-muted">Subscribed</p>
          <p className="text-3xl font-bold tabular-nums">{summary.subscribed}</p>
        </div>
        <div className={panel}>
          <p className="text-sm text-muted">Unsubscribed</p>
          <p className="text-3xl font-bold tabular-nums">{summary.unsubscribed}</p>
        </div>
        <div className={panel}>
          <p className="text-sm text-muted">Waiting for Mailchimp</p>
          <p className="text-3xl font-bold tabular-nums">{summary.waiting}</p>
        </div>
      </div>
      {summary.bySource.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          Joined from:{" "}
          {summary.bySource.map((s) => `${sourceName(s.source)} ${s.count}`).join(" · ")}
        </p>
      )}
      <p className="mb-4 text-sm text-muted">
        The tick box says: &ldquo;{NEWSLETTER_CONSENT}&rdquo; It always starts unticked.
      </p>
      <a href="/admin/newsletter/csv" className={`${secondaryButton} mb-6`}>
        Download CSV
      </a>
      {people.length === 0 ? (
        <p className="text-muted">Nobody yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Email</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Joined from</th>
                <th className={thClass}>Agreed</th>
                <th className={thClass}>Mailchimp</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const waiting = !p.syncedAt || p.syncedAt < p.updatedAt;
                return (
                  <tr key={p.id}>
                    <td className={tdClass}>{p.email}</td>
                    <td className={tdClass}>
                      {p.status === "subscribed" ? (
                        <Pill tone="good">Subscribed</Pill>
                      ) : (
                        <Pill tone="muted">Unsubscribed</Pill>
                      )}
                    </td>
                    <td className={tdClass}>{sourceName(p.source)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatPerthDay(perthDate(p.consentedAt))}
                    </td>
                    <td className={tdClass}>
                      {p.syncError ? (
                        <span className="text-warning-fg">{p.syncError}</span>
                      ) : waiting ? (
                        <span className="text-muted">Waiting</span>
                      ) : (
                        "Up to date"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
