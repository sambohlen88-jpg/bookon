import "server-only";
import { LOCAL_DATABASE_URL, isLocalDatabaseUrl } from "@bookon/db";
import { createMailer } from "@bookon/email";
import { paymentProvider, type LessonContext, type PaymentProvider } from "@bookon/payments";
import { getDb } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

/**
 * Lesson payments (Milestone 15): Stripe when STRIPE_SECRET_KEY is set,
 * practice payments on a local database, otherwise off.
 */
export async function lessonPayments(): Promise<PaymentProvider | null> {
  return paymentProvider(process.env, {
    site: await siteOrigin(),
    localDatabase: isLocalDatabaseUrl(process.env.DATABASE_URL || LOCAL_DATABASE_URL),
  });
}

/** Everything the booking steps need, or null when lesson payments are off. */
export async function lessonContext(): Promise<LessonContext | null> {
  const payments = await lessonPayments();
  if (!payments) return null;
  const db = getDb();
  return { db, payments, mailer: createMailer(db), site: await siteOrigin(), now: new Date() };
}
