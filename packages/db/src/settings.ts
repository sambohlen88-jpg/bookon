import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import { appSettings } from "./schema";

/** Who clubs contact about BookOn, printed on pitch reports. Set in Admin, Settings. */
export interface PitchContact {
  name?: string;
  phone?: string;
  email?: string;
}

export async function pitchContact(db: Database): Promise<PitchContact> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "pitch_contact"));
  return (row?.value as PitchContact | undefined) ?? {};
}

export async function setPitchContact(
  db: Database,
  contact: PitchContact,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "pitch_contact", value: contact, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: contact, updatedAt: now } });
  await logChange(
    db,
    actor,
    { action: "Changed pitch report contact", details: { ...contact } },
    now,
  );
}
