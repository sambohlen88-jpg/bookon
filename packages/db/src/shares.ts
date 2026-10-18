import { randomBytes } from "node:crypto";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { addPerthDays, perthToUtc } from "@bookon/core";
import type { Database } from "./client";
import { sharedSearches } from "./schema";
import type { SearchParams, SearchResult } from "./search";

/** The most times kept per course. A week at a busy course can have hundreds. */
export const SHARE_TIMES_PER_COURSE = 60;
/** Shares one visitor can make in an hour, so nobody can fill the database. */
export const SHARE_LIMIT_PER_HOUR = 30;
/** The same visitor sharing the same search again within this long gets the same link. */
export const SHARE_REUSE_MS = 5 * 60 * 1000;
/** Shares keep working this many days after the last play date. */
export const SHARE_KEEP_DAYS = 7;

export interface SharedTeeTime {
  /** ISO, UTC. */
  startTime: string;
  playDate: string;
  holes: number;
  spotsAvailable: number;
  priceCents: number | null;
  bookingUrl: string;
}

export interface SharedCourse {
  id: string;
  slug: string;
  name: string;
  suburb: string;
  bookingUrl: string;
  /** Every matching time, including any beyond SHARE_TIMES_PER_COURSE. */
  total: number;
  teeTimes: SharedTeeTime[];
}

export interface ShareContent {
  params: SearchParams;
  /** The search's query string, without the leading "?". */
  query: string;
  courses: SharedCourse[];
  totalTeeTimes: number;
}

export interface Share extends ShareContent {
  code: string;
  createdAt: Date;
  expiresAt: Date;
}

/** What a share keeps from a search: courses with times, earliest first. */
export function shareContentFrom(
  result: SearchResult,
  params: SearchParams,
  query: string,
): ShareContent {
  const withTimes = result.courses
    .filter((c) => c.teeTimes.length > 0)
    .map((c) => {
      const sorted = [...c.teeTimes].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return {
        id: c.course.id,
        slug: c.course.slug,
        name: c.course.name,
        suburb: c.course.suburb,
        bookingUrl: c.course.bookingUrl,
        total: sorted.length,
        teeTimes: sorted.slice(0, SHARE_TIMES_PER_COURSE).map((t) => ({
          startTime: t.startTime.toISOString(),
          playDate: t.playDate,
          holes: t.holes,
          spotsAvailable: t.spotsAvailable,
          priceCents: t.priceCents,
          bookingUrl: t.bookingUrl,
        })),
      };
    })
    .sort(
      (a, b) =>
        a.teeTimes[0]!.startTime.localeCompare(b.teeTimes[0]!.startTime) ||
        a.name.localeCompare(b.name),
    );
  return {
    params,
    query: query.replace(/^\?/, ""),
    courses: withTimes,
    totalTeeTimes: withTimes.reduce((n, c) => n + c.total, 0),
  };
}

function newCode(): string {
  // 64 random bits: short enough to text, far too many to guess.
  return randomBytes(8).toString("base64url");
}

export async function createShare(
  db: Database,
  share: { sessionId: string | null; content: ShareContent; now: Date },
): Promise<{ code: string } | { error: "limit" | "empty" }> {
  const { sessionId, content, now } = share;
  if (content.courses.length === 0) return { error: "empty" };
  if (sessionId) {
    const [again] = await db
      .select({ code: sharedSearches.code })
      .from(sharedSearches)
      .where(
        and(
          eq(sharedSearches.anonymousSessionId, sessionId),
          eq(sharedSearches.query, content.query),
          gte(sharedSearches.createdAt, new Date(now.getTime() - SHARE_REUSE_MS)),
        ),
      )
      .limit(1);
    if (again) return again;
    const [recent] = await db
      .select({ n: count() })
      .from(sharedSearches)
      .where(
        and(
          eq(sharedSearches.anonymousSessionId, sessionId),
          gte(sharedSearches.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
        ),
      );
    if ((recent?.n ?? 0) >= SHARE_LIMIT_PER_HOUR) return { error: "limit" };
  }
  const code = newCode();
  await db.insert(sharedSearches).values({
    code,
    createdAt: now,
    expiresAt: perthToUtc(addPerthDays(content.params.dateTo, SHARE_KEEP_DAYS + 1), "00:00"),
    anonymousSessionId: sessionId,
    query: content.query,
    params: content.params,
    courses: content.courses,
    totalTeeTimes: content.totalTeeTimes,
  });
  return { code };
}

/** A share by its code, or null when there's none or it has expired. */
export async function shareByCode(db: Database, code: string, now: Date): Promise<Share | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) return null;
  const [row] = await db.select().from(sharedSearches).where(eq(sharedSearches.code, code));
  if (!row || row.expiresAt <= now) return null;
  return {
    code: row.code,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    query: row.query,
    params: row.params,
    courses: row.courses,
    totalTeeTimes: row.totalTeeTimes,
  };
}

export async function pruneExpiredShares(db: Database, now: Date): Promise<void> {
  await db.delete(sharedSearches).where(lt(sharedSearches.expiresAt, now));
}

/**
 * - open: still showing on the club's page at the last check
 * - gone: booked, or the time has passed
 * - unknown: we couldn't check the club recently, so can't say
 */
export type SharedTimeStatus = "open" | "gone" | "unknown";

/** How each shared time stands now, from a fresh search over the same courses and dates. */
export function sharedTimeStatuses(
  share: ShareContent,
  current: SearchResult,
  now: Date,
): Map<string, SharedTimeStatus> {
  const statuses = new Map<string, SharedTimeStatus>();
  for (const course of share.courses) {
    const live = current.courses.find((c) => c.course.id === course.id);
    for (const t of course.teeTimes) {
      const key = sharedTimeKey(course.id, t);
      if (new Date(t.startTime) <= now) statuses.set(key, "gone");
      else if (!live || live.notices.some((n) => n.date === t.playDate && n.kind !== "not-open"))
        statuses.set(key, "unknown");
      else
        statuses.set(
          key,
          live.teeTimes.some(
            (l) => l.startTime.toISOString() === t.startTime && l.holes === t.holes,
          )
            ? "open"
            : "gone",
        );
    }
  }
  return statuses;
}

export function sharedTimeKey(courseId: string, t: Pick<SharedTeeTime, "startTime" | "holes">) {
  return `${courseId}|${t.startTime}|${t.holes}`;
}
