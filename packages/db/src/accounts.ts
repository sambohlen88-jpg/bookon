import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import type { ClickSource } from "@bookon/core";
import type { Database } from "./client";
import { clickEvents, courses, favourites, signInTokens, users, userSessions } from "./schema";

/** How long an emailed sign-in link works. */
export const SIGN_IN_LINK_TTL_MS = 15 * 60 * 1000;
/** Most sign-in emails one address can be sent in an hour, so nobody can flood an inbox. */
export const SIGN_IN_LINKS_PER_HOUR = 5;
/** How long a device stays signed in. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type User = typeof users.$inferSelect;

/** Lower case and trimmed, or null when it doesn't look like an email address. */
export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only follow `next` to a path on this site, never another site. */
export function safeNextPath(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Create a one-use sign-in link token, or refuse if too many were sent this hour. */
export async function createSignInToken(
  db: Database,
  email: string,
  next: string | null,
  now: Date,
): Promise<{ token: string } | { error: "rate-limited" }> {
  const [recent] = await db
    .select({ n: count() })
    .from(signInTokens)
    .where(
      and(
        eq(signInTokens.email, email),
        gt(signInTokens.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    );
  if ((recent?.n ?? 0) >= SIGN_IN_LINKS_PER_HOUR) return { error: "rate-limited" };

  const token = newToken();
  await db.insert(signInTokens).values({
    email,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SIGN_IN_LINK_TTL_MS),
    next: safeNextPath(next),
  });
  return { token };
}

export interface SignInResult {
  sessionToken: string;
  user: User;
  next: string | null;
}

/**
 * Use a sign-in link: creates the account on first sign-in, starts a device
 * session, and adds this device's earlier clicks to the golfer's visits.
 */
export async function consumeSignInToken(
  db: Database,
  token: string,
  anonymousSessionId: string | null,
  now: Date,
): Promise<SignInResult | null> {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(signInTokens)
      .where(
        and(
          eq(signInTokens.tokenHash, hashToken(token)),
          isNull(signInTokens.usedAt),
          gt(signInTokens.expiresAt, now),
        ),
      );
    if (!link) return null;
    await tx.update(signInTokens).set({ usedAt: now }).where(eq(signInTokens.id, link.id));

    const [user] = await tx
      .insert(users)
      .values({ email: link.email, createdAt: now, lastSignInAt: now })
      .onConflictDoUpdate({ target: users.email, set: { lastSignInAt: now } })
      .returning();

    const sessionToken = newToken();
    await tx.insert(userSessions).values({
      userId: user!.id,
      tokenHash: hashToken(sessionToken),
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });

    if (anonymousSessionId) {
      await tx
        .update(clickEvents)
        .set({ userId: user!.id })
        .where(
          and(eq(clickEvents.anonymousSessionId, anonymousSessionId), isNull(clickEvents.userId)),
        );
    }
    return { sessionToken, user: user!, next: link.next };
  });
}

/** The signed-in golfer for a device cookie, or null. */
export async function userForSession(
  db: Database,
  sessionToken: string,
  now: Date,
): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(eq(userSessions.tokenHash, hashToken(sessionToken)), gt(userSessions.expiresAt, now)),
    );
  return row?.user ?? null;
}

/** The signed-in golfer and when this device signed in, or null. */
export async function sessionForToken(
  db: Database,
  sessionToken: string,
  now: Date,
): Promise<{ user: User; startedAt: Date } | null> {
  const [row] = await db
    .select({ user: users, startedAt: userSessions.createdAt })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(eq(userSessions.tokenHash, hashToken(sessionToken)), gt(userSessions.expiresAt, now)),
    );
  return row ?? null;
}

export async function endSession(db: Database, sessionToken: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.tokenHash, hashToken(sessionToken)));
}

/**
 * Delete an account and everything tied to it: devices, favourites, alerts
 * and their notifications. Clicks stay in club reports, but no longer point to the golfer.
 */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export interface FavouriteCourse {
  id: string;
  slug: string;
  name: string;
  suburb: string;
  kind: "course" | "simulator" | "range";
}

export async function listFavourites(db: Database, userId: string): Promise<FavouriteCourse[]> {
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      name: courses.name,
      suburb: courses.suburb,
      kind: courses.kind,
    })
    .from(favourites)
    .innerJoin(courses, eq(courses.id, favourites.courseId))
    .where(eq(favourites.userId, userId))
    .orderBy(courses.name);
}

export async function setFavourite(
  db: Database,
  userId: string,
  courseId: string,
  on: boolean,
  now: Date,
) {
  if (on) {
    await db.insert(favourites).values({ userId, courseId, createdAt: now }).onConflictDoNothing();
  } else {
    await db
      .delete(favourites)
      .where(and(eq(favourites.userId, userId), eq(favourites.courseId, courseId)));
  }
}

export interface Visit {
  clickedAt: Date;
  startTime: Date | null;
  courseSlug: string;
  courseName: string;
  source: ClickSource;
}

/** Tee times the golfer clicked through to, newest first. */
export async function listVisits(db: Database, userId: string, limit = 50): Promise<Visit[]> {
  return db
    .select({
      clickedAt: clickEvents.createdAt,
      startTime: clickEvents.startTime,
      courseSlug: courses.slug,
      courseName: courses.name,
      source: clickEvents.source,
    })
    .from(clickEvents)
    .innerJoin(courses, eq(courses.id, clickEvents.courseId))
    .where(eq(clickEvents.userId, userId))
    .orderBy(desc(clickEvents.createdAt))
    .limit(limit);
}

/** Forget the golfer's visits. The clicks stay in club reports, unlinked from them. */
export async function clearVisits(db: Database, userId: string): Promise<void> {
  await db.update(clickEvents).set({ userId: null }).where(eq(clickEvents.userId, userId));
}
