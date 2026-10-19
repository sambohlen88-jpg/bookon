import { count, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "./client";
import { deleteUser } from "./accounts";
import { logChange, type Actor } from "./admin";
import { alerts, clubMembers, clubs, coaches, favourites, users } from "./schema";

/**
 * Admin → Users. Groups come from what each person can actually do, so
 * they always match: everyone who signs in is a customer; club owners and
 * staff are the people added to a club; coaches have a coach listing; the
 * admin is the one email in BOOKON_ADMIN_EMAIL.
 */
export const USER_GROUPS = [
  { id: "customer", name: "Customer" },
  { id: "club-owner", name: "Club Owner" },
  { id: "club-staff", name: "Club Staff" },
  { id: "coach", name: "Coach" },
  { id: "admin", name: "Admin" },
] as const;
export type UserGroup = (typeof USER_GROUPS)[number]["id"];

export function isUserGroup(value: unknown): value is UserGroup {
  return USER_GROUPS.some((g) => g.id === value);
}

export interface AdminUser {
  id: string;
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  groups: UserGroup[];
  clubs: { id: string; name: string; role: "owner" | "staff" }[];
  coach: { id: string; name: string; status: string } | null;
  alerts: number;
  favourites: number;
}

/** Every account, newest first, with its groups. */
export async function listUsersForAdmin(
  db: Database,
  adminEmail: string | null,
  only?: string,
): Promise<AdminUser[]> {
  // One after another: the local database takes one query at a time.
  const rows = await db
    .select()
    .from(users)
    .where(only ? eq(users.id, only) : undefined)
    .orderBy(desc(users.createdAt));
  if (rows.length === 0) return [];
  const emails = rows.map((u) => u.email);
  const ids = rows.map((u) => u.id);
  const memberships = await db
    .select({ email: clubMembers.email, role: clubMembers.role, id: clubs.id, name: clubs.name })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(inArray(clubMembers.email, emails));
  const coachRows = await db
    .select({
      id: coaches.id,
      email: coaches.email,
      status: coaches.status,
      profile: coaches.profile,
      draft: coaches.draft,
    })
    .from(coaches)
    .where(inArray(coaches.email, emails));
  const alertCounts = await db
    .select({ userId: alerts.userId, n: count() })
    .from(alerts)
    .where(inArray(alerts.userId, ids))
    .groupBy(alerts.userId);
  const favouriteCounts = await db
    .select({ userId: favourites.userId, n: count() })
    .from(favourites)
    .where(inArray(favourites.userId, ids))
    .groupBy(favourites.userId);

  return rows.map((u) => {
    const memberOf = memberships
      .filter((m) => m.email === u.email)
      .map((m) => ({ id: m.id, name: m.name, role: m.role }));
    const coach = coachRows.find((c) => c.email === u.email);
    const groups: UserGroup[] = ["customer"];
    if (memberOf.some((m) => m.role === "owner")) groups.push("club-owner");
    if (memberOf.some((m) => m.role === "staff")) groups.push("club-staff");
    if (coach) groups.push("coach");
    if (adminEmail && u.email === adminEmail) groups.push("admin");
    return {
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      groups,
      clubs: memberOf,
      coach: coach
        ? {
            id: coach.id,
            name: (coach.draft ?? coach.profile)?.name ?? coach.email,
            status: coach.status,
          }
        : null,
      alerts: alertCounts.find((a) => a.userId === u.id)?.n ?? 0,
      favourites: favouriteCounts.find((f) => f.userId === u.id)?.n ?? 0,
    };
  });
}

export async function userForAdmin(
  db: Database,
  id: string,
  adminEmail: string | null,
): Promise<AdminUser | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await listUsersForAdmin(db, adminEmail, id))[0] ?? null;
}

/**
 * Delete an account for a privacy request: their sign-ins, favourites,
 * alerts and history go with it. Club access and coach listings are kept,
 * as they belong to the club or the listing; remove those on their pages.
 */
export async function deleteUserForAdmin(
  db: Database,
  user: AdminUser,
  actor: Actor,
  now: Date,
): Promise<void> {
  await deleteUser(db, user.id);
  await logChange(
    db,
    actor,
    { action: "Deleted user account", details: { email: user.email } },
    now,
  );
}
