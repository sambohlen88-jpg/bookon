import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  clubById,
  clubRole,
  clubsForEmail,
  coachForEmail,
  sessionForToken,
  type Actor,
  type Club,
  type ClubRole,
  type User,
} from "@bookon/db";
import { AUTH_COOKIE } from "./auth";
import { getDb } from "./db";

/** Admins sign in again after this long, as the admin area changes live data. */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

/**
 * The one admin: the email in BOOKON_ADMIN_EMAIL (or the older
 * BOOKON_ADMIN_EMAILS). BookOn has a single admin, so if more than one
 * address is set, nobody is admin until it's fixed. Admin can't be given
 * from inside the site.
 */
export function adminEmail(env: NodeJS.ProcessEnv = process.env): string | null {
  const emails = (env.BOOKON_ADMIN_EMAIL ?? env.BOOKON_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length > 1) {
    console.error(
      "[access] Only one admin is allowed: set BOOKON_ADMIN_EMAIL to a single address. Admin is off until then.",
    );
    return null;
  }
  return emails[0] ?? null;
}

export function isAdminEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const admin = adminEmail(env);
  return admin !== null && admin === email.toLowerCase();
}

async function session(): Promise<{ user: User; startedAt: Date } | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return token ? sessionForToken(getDb(), token, new Date()) : null;
}

function signIn(next: string, reason?: string): never {
  redirect(`/signin?next=${encodeURIComponent(next)}${reason ? `&reason=${reason}` : ""}`);
}

/**
 * The signed-in admin, or off to sign in. Someone signed in who isn't an
 * admin gets "not found", so the area doesn't advertise itself.
 */
export async function requireAdmin(next = "/admin"): Promise<{ user: User; actor: Actor }> {
  const current = await session();
  if (!current) signIn(next);
  if (!isAdminEmail(current!.user.email)) notFound();
  if (Date.now() - current!.startedAt.getTime() > ADMIN_SESSION_MS) signIn(next, "admin");
  return { user: current!.user, actor: { email: current!.user.email, role: "admin" } };
}

/** For API routes and downloads: whether this request is from a signed-in admin (no redirects). */
export async function isAdminRequest(): Promise<boolean> {
  const current = await session().catch(() => null);
  return Boolean(
    current &&
    isAdminEmail(current.user.email) &&
    Date.now() - current.startedAt.getTime() <= ADMIN_SESSION_MS,
  );
}

/**
 * For analytics (Milestone 23): whether this visitor is signed in, and
 * whether it's the admin, whose own visits aren't counted.
 */
export async function visitorKind(): Promise<{ signedIn: boolean; admin: boolean }> {
  const current = await session().catch(() => null);
  return {
    signedIn: Boolean(current),
    admin: Boolean(current && isAdminEmail(current.user.email)),
  };
}

/**
 * The signed-in member of this club (or an admin, who can act as owner),
 * or off to sign in.
 */
export async function requireClub(
  clubId: string,
  next: string,
): Promise<{ user: User; club: Club; role: ClubRole; actor: Actor; admin: boolean }> {
  const current = await session();
  if (!current) signIn(next);
  const db = getDb();
  const club = await clubById(db, clubId);
  if (!club) notFound();
  const admin = isAdminEmail(current!.user.email);
  const role = admin ? "owner" : await clubRole(db, club!.id, current!.user.email);
  if (!role) notFound();
  return {
    user: current!.user,
    club: club!,
    role,
    admin,
    actor: { email: current!.user.email, role: admin ? "admin" : "club" },
  };
}

/** For API routes: the signed-in person's access to a club, or null (no redirects). */
export async function clubAccess(clubId: string): Promise<{ actor: Actor; club: Club } | null> {
  const current = await session();
  if (!current) return null;
  const db = getDb();
  const club = await clubById(db, clubId);
  if (!club) return null;
  const admin = isAdminEmail(current.user.email);
  if (!admin && !(await clubRole(db, club.id, current.user.email))) return null;
  return { club, actor: { email: current.user.email, role: admin ? "admin" : "club" } };
}

/** For the header: what extra areas this person can open. */
export async function currentAccess(): Promise<{
  user: User | null;
  admin: boolean;
  clubs: number;
  /** Has a coach listing. */
  coach: boolean;
}> {
  const current = await session().catch(() => null);
  if (!current) return { user: null, admin: false, clubs: 0, coach: false };
  const clubs = await clubsForEmail(getDb(), current.user.email).catch(() => []);
  const coach = await coachForEmail(getDb(), current.user.email).catch(() => null);
  return {
    user: current.user,
    admin: isAdminEmail(current.user.email),
    clubs: clubs.length,
    coach: Boolean(coach),
  };
}
