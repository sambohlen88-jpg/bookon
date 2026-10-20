import { eq } from "drizzle-orm";
import { DEFAULT_WA_CALENDAR, type WaCalendar } from "@bookon/core";
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

/** WA public holidays and school holidays for coaches' special rates (Milestone 19). */
export async function waCalendar(db: Database): Promise<WaCalendar> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "wa_calendar"));
  return (row?.value as WaCalendar | undefined) ?? DEFAULT_WA_CALENDAR;
}

export async function setWaCalendar(
  db: Database,
  calendar: WaCalendar,
  actor: Actor,
  now: Date,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "wa_calendar", value: calendar, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: calendar, updatedAt: now } });
  await logChange(
    db,
    actor,
    {
      action: "Changed WA holiday dates",
      details: {
        publicHolidays: calendar.publicHolidays.length,
        schoolHolidays: calendar.schoolHolidays.length,
      },
    },
    now,
  );
}
