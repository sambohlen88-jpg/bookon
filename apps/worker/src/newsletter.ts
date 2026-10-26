import { markNewsletterSynced, newsletterChangesToSync, type Database } from "@bookon/db";
import type { MarketingList } from "@bookon/email";

/**
 * Copy newsletter changes to Mailchimp (Milestone 27): people who ticked the
 * box, and people who unsubscribed in My account or deleted their account.
 * A failure is kept on the row, shown in Admin, and tried again next pass.
 */
export async function syncNewsletter(
  db: Database,
  list: MarketingList,
): Promise<{ synced: number; pending: number; failed: number }> {
  const result = { synced: 0, pending: 0, failed: 0 };
  for (const row of await newsletterChangesToSync(db)) {
    try {
      const outcome = await list.setStatus(row.email, row.status, row.consentedAt);
      await markNewsletterSynced(db, row.id, row.updatedAt, null);
      result[outcome === "pending" ? "pending" : "synced"]++;
    } catch (error) {
      await markNewsletterSynced(db, row.id, row.updatedAt, String((error as Error).message));
      result.failed++;
    }
  }
  return result;
}
