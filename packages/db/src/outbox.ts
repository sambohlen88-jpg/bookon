import { desc } from "drizzle-orm";
import type { Database } from "./client";
import { outboxEmails } from "./schema";

export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Keep a development email instead of sending it. */
export async function addOutboxEmail(
  db: Database,
  message: OutboxMessage,
  now = new Date(),
): Promise<void> {
  await db.insert(outboxEmails).values({ ...message, createdAt: now });
}

export async function listOutboxEmails(db: Database, limit = 50) {
  return db.select().from(outboxEmails).orderBy(desc(outboxEmails.createdAt)).limit(limit);
}
