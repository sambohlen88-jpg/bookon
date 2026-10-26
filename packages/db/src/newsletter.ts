/**
 * BookOn's newsletter list (Milestone 27). People join by ticking a box that
 * starts unticked, and BookOn keeps when, where and the words they agreed to.
 * Every change waits for the worker to copy it to Mailchimp, which sends the
 * newsletters; unsubscribing in Mailchimp comes back through its webhook.
 */
import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "./client";
import { newsletterSubscribers } from "./schema";

/** The tick box wording. Changing it changes what new subscribers agree to. */
export const NEWSLETTER_CONSENT =
  "Send me BookOn news, golf tips and offers. Unsubscribe any time.";

export const NEWSLETTER_SOURCES = {
  signin: "Signing in",
  account: "My account",
  lesson: "Booking a lesson",
  "group-session": "Booking a group session",
  event: "Entering an event",
  matchplay: "Entering match play",
  mailchimp: "Mailchimp sign-up form",
} as const;
export type NewsletterSource = keyof typeof NEWSLETTER_SOURCES;

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

/**
 * Add someone, or bring them back after unsubscribing. `synced` is for
 * changes that came from Mailchimp, so they aren't sent straight back.
 */
export async function subscribeNewsletter(
  db: Database,
  input: { email: string; source: NewsletterSource; now: Date; synced?: boolean },
): Promise<void> {
  const values = {
    status: "subscribed" as const,
    source: input.source,
    consentText: NEWSLETTER_CONSENT,
    consentedAt: input.now,
    unsubscribedAt: null,
    unsubscribedVia: null,
    updatedAt: input.now,
    ...(input.synced ? { syncedAt: input.now, syncError: null } : {}),
  };
  await db
    .insert(newsletterSubscribers)
    .values({ email: input.email.toLowerCase(), ...values })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: values });
}

/** Take someone off the list. Does nothing if they aren't on it. */
export async function unsubscribeNewsletter(
  db: Database,
  input: { email: string; via: "account" | "mailchimp" | "account-deleted"; now: Date },
): Promise<void> {
  await db
    .update(newsletterSubscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: input.now,
      unsubscribedVia: input.via,
      updatedAt: input.now,
      ...(input.via === "mailchimp" ? { syncedAt: input.now, syncError: null } : {}),
    })
    .where(
      and(
        eq(newsletterSubscribers.email, input.email.toLowerCase()),
        eq(newsletterSubscribers.status, "subscribed"),
      ),
    );
}

export async function isSubscribed(db: Database, email: string): Promise<boolean> {
  const [row] = await db
    .select({ status: newsletterSubscribers.status })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()));
  return row?.status === "subscribed";
}

/** Changes Mailchimp hasn't had yet, oldest first. */
export async function newsletterChangesToSync(
  db: Database,
  limit = 100,
): Promise<NewsletterSubscriber[]> {
  return db
    .select()
    .from(newsletterSubscribers)
    .where(
      or(
        isNull(newsletterSubscribers.syncedAt),
        lt(newsletterSubscribers.syncedAt, newsletterSubscribers.updatedAt),
      ),
    )
    .orderBy(newsletterSubscribers.updatedAt)
    .limit(limit);
}

/** Record a sync: done, or the problem to show in Admin and try again next time. */
export async function markNewsletterSynced(
  db: Database,
  id: string,
  syncedUpTo: Date,
  error: string | null,
): Promise<void> {
  await db
    .update(newsletterSubscribers)
    .set(error ? { syncError: error.slice(0, 300) } : { syncedAt: syncedUpTo, syncError: null })
    .where(eq(newsletterSubscribers.id, id));
}

export interface NewsletterSummary {
  subscribed: number;
  unsubscribed: number;
  waiting: number;
  problems: number;
  bySource: { source: string; count: number }[];
}

export async function newsletterSummary(db: Database): Promise<NewsletterSummary> {
  const statuses = await db
    .select({ status: newsletterSubscribers.status, n: count() })
    .from(newsletterSubscribers)
    .groupBy(newsletterSubscribers.status);
  const sources = await db
    .select({ source: newsletterSubscribers.source, n: count() })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "subscribed"))
    .groupBy(newsletterSubscribers.source)
    .orderBy(desc(count()));
  const [waiting] = await db
    .select({
      n: count(),
      problems: sql<number>`count(*) filter (where ${newsletterSubscribers.syncError} is not null)`,
    })
    .from(newsletterSubscribers)
    .where(
      or(
        isNull(newsletterSubscribers.syncedAt),
        lt(newsletterSubscribers.syncedAt, newsletterSubscribers.updatedAt),
      ),
    );
  const of = (status: string) => statuses.find((s) => s.status === status)?.n ?? 0;
  return {
    subscribed: of("subscribed"),
    unsubscribed: of("unsubscribed"),
    waiting: waiting?.n ?? 0,
    problems: Number(waiting?.problems ?? 0),
    bySource: sources.map((s) => ({ source: s.source, count: s.n })),
  };
}

/** Everyone on the list, newest change first, for Admin and the CSV. */
export async function listNewsletterSubscribers(
  db: Database,
  limit?: number,
): Promise<NewsletterSubscriber[]> {
  const query = db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.updatedAt));
  return limit ? query.limit(limit) : query;
}
