import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  CHECKOUT_MINUTES,
  DISPUTE_HOURS,
  drawSize,
  matchesInRound,
  nextSlot,
  placeDraw,
  roundCount,
} from "@bookon/core";
import type { Database } from "./client";
import { logChange, type Actor } from "./admin";
import {
  clubs,
  courses,
  matchplayComps,
  matchplayEntries,
  matchplayMatches,
  type MatchplayPlayer,
  type MatchplayRound,
} from "./schema";

/**
 * Match play (Milestone 22): knockout competitions. Results are as the
 * players report them, with DISPUTE_HOURS for the other side to dispute;
 * the club has the final say. Winners go through to the next round by
 * themselves.
 */

export type MatchplayComp = typeof matchplayComps.$inferSelect;
export type MatchplayEntry = typeof matchplayEntries.$inferSelect;
export type MatchplayMatch = typeof matchplayMatches.$inferSelect;
export type { MatchplayPlayer, MatchplayRound };

export class MatchplayProblem extends Error {}

/* Competitions */

export interface CompInput {
  courseId: string;
  title: string;
  description: string | null;
  teamSize: number;
  onlineEntry: boolean;
  feeCents: number;
  maxEntries: number;
  entriesClose: Date | null;
  open: boolean;
}

export async function createComp(
  db: Database,
  clubId: string,
  input: CompInput,
  actor: Actor,
  now: Date,
): Promise<MatchplayComp> {
  const [row] = await db
    .insert(matchplayComps)
    .values({ ...input, clubId, createdBy: actor.email, createdAt: now, updatedAt: now })
    .returning();
  await logChange(
    db,
    actor,
    { action: "Set up a match play competition", clubId, details: { title: input.title } },
    now,
  );
  return row!;
}

/** Change a competition before its draw. Once anyone has entered, the format and fee stay. */
export async function updateComp(
  db: Database,
  comp: MatchplayComp,
  input: CompInput,
  now: Date,
): Promise<MatchplayComp> {
  if (comp.status !== "entries")
    throw new MatchplayProblem("The draw has been made, so the details can't change now.");
  const entered = (await entryCounts(db, [comp.id], now)).get(comp.id) ?? 0;
  if (input.maxEntries < entered)
    throw new MatchplayProblem(`${entered} have already entered, so the field can't be smaller.`);
  const locked = entered > 0 ? { teamSize: comp.teamSize, feeCents: comp.feeCents } : {};
  const [row] = await db
    .update(matchplayComps)
    .set({ ...input, ...locked, updatedAt: now })
    .where(eq(matchplayComps.id, comp.id))
    .returning();
  return row!;
}

export async function compById(db: Database, id: string): Promise<MatchplayComp | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(matchplayComps).where(eq(matchplayComps.id, id));
  return row ?? null;
}

/** Entries in, or held at checkout, for each competition. */
export async function entryCounts(
  db: Database,
  compIds: string[],
  now: Date,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(compIds.map((id) => [id, 0]));
  if (compIds.length === 0) return counts;
  const rows = await db
    .select({ compId: matchplayEntries.compId, n: sql<number>`count(*)::int` })
    .from(matchplayEntries)
    .where(
      and(
        inArray(matchplayEntries.compId, compIds),
        or(
          eq(matchplayEntries.status, "entered"),
          and(eq(matchplayEntries.status, "checkout"), gt(matchplayEntries.checkoutExpiresAt, now)),
        ),
      ),
    )
    .groupBy(matchplayEntries.compId);
  for (const r of rows) counts.set(r.compId, Number(r.n));
  return counts;
}

export interface ListedComp extends MatchplayComp {
  entered: number;
  clubName: string;
  courseName: string;
  courseSlug: string;
  area: string | null;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  clubPaymentsReady: boolean;
}

async function listed(db: Database, where: ReturnType<typeof and>, now: Date) {
  const rows = await db
    .select({
      comp: matchplayComps,
      clubName: clubs.name,
      clubPaymentsReady: clubs.paymentsReady,
      courseName: courses.name,
      courseSlug: courses.slug,
      area: courses.area,
      suburb: courses.suburb,
      latitude: courses.latitude,
      longitude: courses.longitude,
    })
    .from(matchplayComps)
    .innerJoin(clubs, eq(clubs.id, matchplayComps.clubId))
    .innerJoin(courses, eq(courses.id, matchplayComps.courseId))
    .where(where)
    .orderBy(desc(matchplayComps.createdAt));
  const counts = await entryCounts(
    db,
    rows.map((r) => r.comp.id),
    now,
  );
  return rows.map(({ comp, ...rest }): ListedComp => ({
    ...comp,
    ...rest,
    entered: counts.get(comp.id) ?? 0,
  }));
}

export function compsForClub(db: Database, clubId: string, now: Date) {
  return listed(db, and(eq(matchplayComps.clubId, clubId)), now);
}

export async function listedComp(db: Database, id: string, now: Date): Promise<ListedComp | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await listed(db, and(eq(matchplayComps.id, id)), now))[0] ?? null;
}

/** Open competitions taking entries or being played, for the Competitions page. */
export function openComps(db: Database, now: Date) {
  return listed(
    db,
    and(eq(matchplayComps.open, true), inArray(matchplayComps.status, ["entries", "playing"])),
    now,
  );
}

export function listCompsForAdmin(db: Database, now: Date) {
  return listed(db, and(), now);
}

/* Entries */

export interface OnlineEntryInput {
  compId: string;
  players: MatchplayPlayer[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  userId?: string | null;
  /** Paid entries wait at checkout; free ones go straight in. */
  feesCents: number;
  bookingFeeCents: number;
  provider: string | null;
}

/** Enter online. A paid entry holds a place at checkout for CHECKOUT_MINUTES. */
export async function createOnlineEntry(
  db: Database,
  input: OnlineEntryInput,
  now: Date,
): Promise<MatchplayEntry> {
  return db.transaction(async (tx) => {
    const [comp] = await tx
      .select()
      .from(matchplayComps)
      .where(eq(matchplayComps.id, input.compId))
      .for("update");
    if (!comp || comp.status !== "entries" || !comp.onlineEntry)
      throw new MatchplayProblem("This competition isn't taking entries.");
    if (comp.entriesClose && comp.entriesClose <= now)
      throw new MatchplayProblem("Entries for this competition have closed.");
    if (input.players.length !== comp.teamSize)
      throw new MatchplayProblem(
        comp.teamSize === 2 ? "Add both players' names." : "Add your name.",
      );
    const entered =
      (await entryCounts(tx as unknown as Database, [comp.id], now)).get(comp.id) ?? 0;
    if (entered >= comp.maxEntries) throw new MatchplayProblem("Sorry, the field is full.");
    const paid = input.feesCents > 0;
    const [row] = await tx
      .insert(matchplayEntries)
      .values({
        compId: comp.id,
        status: paid ? "checkout" : "entered",
        players: input.players,
        contactName: input.contactName,
        contactEmail: input.contactEmail.toLowerCase(),
        contactPhone: input.contactPhone,
        source: "online",
        userId: input.userId ?? null,
        feesCents: input.feesCents,
        bookingFeeCents: paid ? input.bookingFeeCents : 0,
        manageToken: randomBytes(24).toString("base64url"),
        provider: paid ? input.provider : null,
        checkoutExpiresAt: paid ? new Date(now.getTime() + CHECKOUT_MINUTES * 60_000) : null,
        enteredAt: paid ? null : now,
        createdAt: now,
      })
      .returning();
    return row!;
  });
}

/** The club adds an entry by hand, before the draw. */
export async function addClubEntry(
  db: Database,
  comp: MatchplayComp,
  input: { players: MatchplayPlayer[]; contactEmail: string | null; contactPhone: string | null },
  actor: Actor,
  now: Date,
): Promise<MatchplayEntry> {
  if (comp.status !== "entries")
    throw new MatchplayProblem("The draw has been made. Start the draw again to add someone.");
  const entered = (await entryCounts(db, [comp.id], now)).get(comp.id) ?? 0;
  if (entered >= comp.maxEntries) throw new MatchplayProblem("The field is full.");
  const [row] = await db
    .insert(matchplayEntries)
    .values({
      compId: comp.id,
      status: "entered",
      players: input.players,
      contactName: input.players[0]!.name,
      contactEmail: input.contactEmail?.toLowerCase() ?? null,
      contactPhone: input.contactPhone,
      source: "club",
      manageToken: randomBytes(24).toString("base64url"),
      enteredAt: now,
      createdAt: now,
    })
    .returning();
  await logChange(
    db,
    actor,
    {
      action: "Added a match play entry",
      clubId: comp.clubId,
      details: { title: comp.title, entry: row!.contactName },
    },
    now,
  );
  return row!;
}

/** Entries in, in the order they came. */
export function entriesForComp(db: Database, compId: string): Promise<MatchplayEntry[]> {
  return db
    .select()
    .from(matchplayEntries)
    .where(and(eq(matchplayEntries.compId, compId), eq(matchplayEntries.status, "entered")))
    .orderBy(asc(matchplayEntries.enteredAt), asc(matchplayEntries.createdAt));
}

/** Entries withdrawn, or in a cancelled competition, newest first. */
export function endedMpEntries(db: Database, compId: string): Promise<MatchplayEntry[]> {
  return db
    .select()
    .from(matchplayEntries)
    .where(
      and(
        eq(matchplayEntries.compId, compId),
        inArray(matchplayEntries.status, ["withdrawn", "cancelled"]),
      ),
    )
    .orderBy(desc(matchplayEntries.cancelledAt));
}

export async function mpEntryById(db: Database, id: string): Promise<MatchplayEntry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(matchplayEntries).where(eq(matchplayEntries.id, id));
  return row ?? null;
}

export async function mpEntryByToken(db: Database, token: string): Promise<MatchplayEntry | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select()
    .from(matchplayEntries)
    .where(eq(matchplayEntries.manageToken, token));
  return row ?? null;
}

export async function mpEntryByCheckout(
  db: Database,
  checkoutId: string,
): Promise<MatchplayEntry | null> {
  const [row] = await db
    .select()
    .from(matchplayEntries)
    .where(eq(matchplayEntries.checkoutId, checkoutId));
  return row ?? null;
}

export async function setMpEntryCheckout(db: Database, id: string, checkoutId: string) {
  await db.update(matchplayEntries).set({ checkoutId }).where(eq(matchplayEntries.id, id));
}

async function moveEntry(
  db: Database,
  id: string,
  from: MatchplayEntry["status"][],
  set: Partial<typeof matchplayEntries.$inferInsert>,
): Promise<MatchplayEntry | null> {
  const [row] = await db
    .update(matchplayEntries)
    .set(set)
    .where(and(eq(matchplayEntries.id, id), inArray(matchplayEntries.status, from)))
    .returning();
  return row ?? null;
}

export function markMpEntryPaid(db: Database, id: string, paymentId: string, now: Date) {
  return moveEntry(db, id, ["checkout"], { status: "entered", paymentId, enteredAt: now });
}

export function markMpEntryAbandoned(db: Database, id: string) {
  return moveEntry(db, id, ["checkout"], { status: "abandoned" });
}

/** Take an entry out before the draw is published: withdrawn, or the competition was cancelled. */
export function endMpEntry(
  db: Database,
  id: string,
  input: { by: "golfer" | "club" | "comp"; refundCents: number },
  now: Date,
) {
  return moveEntry(db, id, ["entered"], {
    status: input.by === "comp" ? "cancelled" : "withdrawn",
    cancelledAt: now,
    cancelledBy: input.by,
    refundCents: input.refundCents,
    seed: null,
  });
}

export function staleMpCheckouts(db: Database, now: Date): Promise<MatchplayEntry[]> {
  return db
    .select()
    .from(matchplayEntries)
    .where(
      and(eq(matchplayEntries.status, "checkout"), lte(matchplayEntries.checkoutExpiresAt, now)),
    );
}

/** Paid entries in cancelled competitions, still to be refunded. */
export function mpEntriesToRefund(db: Database, compId?: string) {
  return db
    .select({ entry: matchplayEntries, comp: matchplayComps })
    .from(matchplayEntries)
    .innerJoin(matchplayComps, eq(matchplayComps.id, matchplayEntries.compId))
    .where(
      and(
        eq(matchplayEntries.status, "entered"),
        eq(matchplayComps.status, "cancelled"),
        compId ? eq(matchplayComps.id, compId) : undefined,
      ),
    );
}

export async function cancelComp(
  db: Database,
  comp: MatchplayComp,
  note: string | null,
  actor: Actor,
  now: Date,
): Promise<MatchplayComp | null> {
  const [row] = await db
    .update(matchplayComps)
    .set({ status: "cancelled", cancelledAt: now, cancelNote: note, updatedAt: now })
    .where(
      and(
        eq(matchplayComps.id, comp.id),
        inArray(matchplayComps.status, ["entries", "drawn", "playing"]),
      ),
    )
    .returning();
  if (row)
    await logChange(
      db,
      actor,
      {
        action: "Cancelled a match play competition",
        clubId: comp.clubId,
        details: { title: comp.title },
      },
      now,
    );
  return row ?? null;
}

/** Seeds set by the club: 1 is the top seed; null for unseeded. */
export async function setSeeds(
  db: Database,
  comp: MatchplayComp,
  seeds: Map<string, number | null>,
): Promise<void> {
  if (comp.status !== "entries" && comp.status !== "drawn")
    throw new MatchplayProblem("The draw is out, so seeds can't change.");
  for (const [entryId, seed] of seeds)
    await db
      .update(matchplayEntries)
      .set({ seed })
      .where(and(eq(matchplayEntries.id, entryId), eq(matchplayEntries.compId, comp.id)));
}

/* The draw */

export function matchesForComp(db: Database, compId: string): Promise<MatchplayMatch[]> {
  return db
    .select()
    .from(matchplayMatches)
    .where(eq(matchplayMatches.compId, compId))
    .orderBy(asc(matchplayMatches.round), asc(matchplayMatches.slot));
}

/** Write a whole draw from its first-round positions (null is a bye), sending bye winners through. */
async function writeDraw(
  db: Database,
  comp: MatchplayComp,
  positions: (string | null)[],
  now: Date,
): Promise<MatchplayComp> {
  const size = positions.length;
  const rounds = Math.log2(size);
  await db.delete(matchplayMatches).where(eq(matchplayMatches.compId, comp.id));
  const rows: (typeof matchplayMatches.$inferInsert)[] = [];
  for (let round = 1; round <= rounds; round++)
    for (let slot = 0; slot < matchesInRound(size, round); slot++)
      rows.push({ compId: comp.id, round, slot, status: "waiting" });
  // First round from the positions; a bye sends the other side straight through.
  for (let slot = 0; slot < size / 2; slot++) {
    const a = positions[slot * 2] ?? null;
    const b = positions[slot * 2 + 1] ?? null;
    const row = rows[slot]!;
    row.entryA = a;
    row.entryB = b;
    if (a && b) row.status = "to-play";
    else if (a || b) {
      row.status = "done";
      row.winnerEntryId = a ?? b;
      row.score = "Bye";
      row.decidedAt = now;
      const next = nextSlot(1, slot);
      const target = rows.find((r) => r.round === next.round && r.slot === next.slot)!;
      if (next.side === "a") target.entryA = a ?? b;
      else target.entryB = a ?? b;
    }
  }
  for (const r of rows) if (r.round === 2 && r.entryA && r.entryB) r.status = "to-play";
  await db.insert(matchplayMatches).values(rows);
  const keep = comp.rounds ?? [];
  const [row] = await db
    .update(matchplayComps)
    .set({
      status: "drawn",
      drawSize: size,
      rounds: Array.from({ length: rounds }, (_, i) => keep[i] ?? { playBy: null }),
      updatedAt: now,
    })
    .where(eq(matchplayComps.id, comp.id))
    .returning();
  return row!;
}

/**
 * Make (or remake) the draw: seeds in order, then everyone else in the order
 * `arrange` gives (shuffled for a random draw). Byes go to the top seeds.
 */
export async function makeDraw(
  db: Database,
  comp: MatchplayComp,
  arrange: <T>(items: T[]) => T[],
  now: Date,
): Promise<MatchplayComp> {
  if (comp.status !== "entries" && comp.status !== "drawn")
    throw new MatchplayProblem("The draw is already out.");
  const entries = await entriesForComp(db, comp.id);
  if (entries.length < 2) throw new MatchplayProblem("A draw needs at least two entries.");
  const seeded = entries
    .filter((e) => e.seed !== null)
    .sort((a, b) => a.seed! - b.seed!)
    .map((e) => e.id);
  const others = arrange(entries.filter((e) => e.seed === null).map((e) => e.id));
  return writeDraw(db, comp, placeDraw(seeded, others), now);
}

/** Swap two entries in the first round, before the draw is published. */
export async function swapInDraw(
  db: Database,
  comp: MatchplayComp,
  first: string,
  second: string,
  now: Date,
): Promise<MatchplayComp> {
  if (comp.status !== "drawn") throw new MatchplayProblem("Make the draw first.");
  if (first === second) throw new MatchplayProblem("Pick two different entries to swap.");
  const firstRound = (await matchesForComp(db, comp.id)).filter((m) => m.round === 1);
  const positions = firstRound.flatMap((m) => [m.entryA, m.entryB]);
  const i = positions.indexOf(first);
  const j = positions.indexOf(second);
  if (i === -1 || j === -1) throw new MatchplayProblem("Pick two entries in the draw.");
  [positions[i], positions[j]] = [positions[j]!, positions[i]!];
  return writeDraw(db, comp, positions, now);
}

/** Undo an unpublished draw, so the club can add or withdraw entries again. */
export async function reopenEntries(
  db: Database,
  comp: MatchplayComp,
  now: Date,
): Promise<MatchplayComp> {
  if (comp.status !== "drawn") throw new MatchplayProblem("There's no draw to undo.");
  await db.delete(matchplayMatches).where(eq(matchplayMatches.compId, comp.id));
  const [row] = await db
    .update(matchplayComps)
    .set({ status: "entries", drawSize: null, updatedAt: now })
    .where(eq(matchplayComps.id, comp.id))
    .returning();
  return row!;
}

/** Play-by dates, one per round (Perth dates, or null). */
export async function setRoundDates(
  db: Database,
  comp: MatchplayComp,
  playBy: (string | null)[],
  now: Date,
): Promise<void> {
  const rounds = roundCount(comp.drawSize ?? 2);
  await db
    .update(matchplayComps)
    .set({
      rounds: Array.from({ length: rounds }, (_, i) => ({ playBy: playBy[i] ?? null })),
      updatedAt: now,
    })
    .where(eq(matchplayComps.id, comp.id));
}

export async function publishDraw(
  db: Database,
  comp: MatchplayComp,
  actor: Actor,
  now: Date,
): Promise<MatchplayComp> {
  if (comp.status !== "drawn") throw new MatchplayProblem("Make the draw first.");
  const [row] = await db
    .update(matchplayComps)
    .set({ status: "playing", publishedAt: now, updatedAt: now })
    .where(and(eq(matchplayComps.id, comp.id), eq(matchplayComps.status, "drawn")))
    .returning();
  if (!row) throw new MatchplayProblem("The draw is already out.");
  await logChange(
    db,
    actor,
    { action: "Published a match play draw", clubId: comp.clubId, details: { title: comp.title } },
    now,
  );
  return row;
}

/* Results */

export async function matchById(db: Database, id: string): Promise<MatchplayMatch | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(matchplayMatches).where(eq(matchplayMatches.id, id));
  return row ?? null;
}

function sideOf(match: MatchplayMatch, entryId: string): "a" | "b" | null {
  return match.entryA === entryId ? "a" : match.entryB === entryId ? "b" : null;
}

export interface Advanced {
  /** The next match, when both its sides are now known and it can be played. */
  ready: MatchplayMatch | null;
  /** The competition's winner, after the final. */
  champion: string | null;
}

/**
 * Send a decided match's winner on: into the next round, or as the champion.
 * If the club changed a winner, the next match's side is replaced, as long as
 * that match hasn't been decided.
 */
async function advance(db: Database, match: MatchplayMatch, now: Date): Promise<Advanced> {
  const comp = (await compById(db, match.compId))!;
  const rounds = roundCount(comp.drawSize ?? 2);
  if (match.round === rounds) {
    await db
      .update(matchplayComps)
      .set({ status: "finished", winnerEntryId: match.winnerEntryId, updatedAt: now })
      .where(eq(matchplayComps.id, comp.id));
    return { ready: null, champion: match.winnerEntryId };
  }
  const next = nextSlot(match.round, match.slot);
  const [target] = await db
    .select()
    .from(matchplayMatches)
    .where(
      and(
        eq(matchplayMatches.compId, comp.id),
        eq(matchplayMatches.round, next.round),
        eq(matchplayMatches.slot, next.slot),
      ),
    );
  const entryA = next.side === "a" ? match.winnerEntryId : target!.entryA;
  const entryB = next.side === "b" ? match.winnerEntryId : target!.entryB;
  const status = entryA && entryB ? "to-play" : "waiting";
  const [updated] = await db
    .update(matchplayMatches)
    .set({ entryA, entryB, status, reminderSentAt: null, overdueNoticeAt: null })
    .where(eq(matchplayMatches.id, target!.id))
    .returning();
  return { ready: status === "to-play" ? updated! : null, champion: null };
}

/** One side reports the result. The other side has DISPUTE_HOURS to dispute it. */
export async function reportResult(
  db: Database,
  match: MatchplayMatch,
  byEntryId: string,
  winnerEntryId: string,
  score: string,
  now: Date,
): Promise<MatchplayMatch> {
  if (match.status !== "to-play") throw new MatchplayProblem("This match already has a result.");
  if (!sideOf(match, byEntryId) || !sideOf(match, winnerEntryId))
    throw new MatchplayProblem("That isn't one of the players in this match.");
  const [row] = await db
    .update(matchplayMatches)
    .set({
      status: "reported",
      winnerEntryId,
      score: score.trim().slice(0, 30) || null,
      reportedBy: byEntryId,
      reportedAt: now,
      disputeBy: new Date(now.getTime() + DISPUTE_HOURS * 3_600_000),
    })
    .where(and(eq(matchplayMatches.id, match.id), eq(matchplayMatches.status, "to-play")))
    .returning();
  if (!row) throw new MatchplayProblem("This match already has a result.");
  return row;
}

/** The other side agrees: the result stands straight away. */
export async function confirmResult(
  db: Database,
  match: MatchplayMatch,
  byEntryId: string,
  now: Date,
): Promise<{ match: MatchplayMatch; advanced: Advanced }> {
  if (match.status !== "reported" || !sideOf(match, byEntryId) || match.reportedBy === byEntryId)
    throw new MatchplayProblem("There's nothing for you to confirm.");
  return decide(db, match, ["reported"], {}, now);
}

export async function disputeResult(
  db: Database,
  match: MatchplayMatch,
  byEntryId: string,
  note: string | null,
  now: Date,
): Promise<MatchplayMatch> {
  if (match.status !== "reported" || !sideOf(match, byEntryId) || match.reportedBy === byEntryId)
    throw new MatchplayProblem("There's nothing for you to dispute.");
  if (match.disputeBy && match.disputeBy <= now)
    throw new MatchplayProblem("The time to dispute this result has passed. Contact the club.");
  const [row] = await db
    .update(matchplayMatches)
    .set({ status: "disputed", disputeNote: note })
    .where(and(eq(matchplayMatches.id, match.id), eq(matchplayMatches.status, "reported")))
    .returning();
  if (!row) throw new MatchplayProblem("There's nothing for you to dispute.");
  return row;
}

async function decide(
  db: Database,
  match: MatchplayMatch,
  from: string[],
  set: Partial<typeof matchplayMatches.$inferInsert>,
  now: Date,
): Promise<{ match: MatchplayMatch; advanced: Advanced }> {
  const [row] = await db
    .update(matchplayMatches)
    .set({ ...set, status: "done", decidedAt: now })
    .where(and(eq(matchplayMatches.id, match.id), inArray(matchplayMatches.status, from)))
    .returning();
  if (!row) throw new MatchplayProblem("This match has already moved on.");
  return { match: row, advanced: await advance(db, row, now) };
}

/** The club enters or corrects a result, or awards a walkover. The club has the final say. */
export async function clubSetResult(
  db: Database,
  match: MatchplayMatch,
  winnerEntryId: string,
  score: string,
  now: Date,
): Promise<{ match: MatchplayMatch; advanced: Advanced }> {
  if (!match.entryA || !match.entryB)
    throw new MatchplayProblem("Both sides of this match aren't known yet.");
  if (!sideOf(match, winnerEntryId))
    throw new MatchplayProblem("Pick one of the players in this match.");
  if (match.status === "done") {
    // Correcting a decided match: only while the next match hasn't been decided.
    const comp = (await compById(db, match.compId))!;
    if (match.round < roundCount(comp.drawSize ?? 2)) {
      const next = nextSlot(match.round, match.slot);
      const [target] = await db
        .select()
        .from(matchplayMatches)
        .where(
          and(
            eq(matchplayMatches.compId, comp.id),
            eq(matchplayMatches.round, next.round),
            eq(matchplayMatches.slot, next.slot),
          ),
        );
      if (target && target.status !== "waiting" && target.status !== "to-play")
        throw new MatchplayProblem(
          "The next round's match already has a result, so this one can't change.",
        );
    }
  }
  return decide(
    db,
    match,
    ["to-play", "reported", "disputed", "done"],
    { winnerEntryId, score: score.trim().slice(0, 30) || null },
    now,
  );
}

/** Reported results nobody disputed in time: they stand. */
export async function finaliseReported(db: Database, now: Date) {
  const due = await db
    .select()
    .from(matchplayMatches)
    .where(and(eq(matchplayMatches.status, "reported"), lte(matchplayMatches.disputeBy, now)));
  const done: { match: MatchplayMatch; advanced: Advanced }[] = [];
  for (const m of due) {
    try {
      done.push(await decide(db, m, ["reported"], {}, now));
    } catch {
      // Moved on meanwhile.
    }
  }
  return done;
}

/* Worker */

/** Matches still to play, in published competitions, with their competition. */
export function openMatches(db: Database) {
  return db
    .select({ match: matchplayMatches, comp: matchplayComps })
    .from(matchplayMatches)
    .innerJoin(matchplayComps, eq(matchplayComps.id, matchplayMatches.compId))
    .where(
      and(
        eq(matchplayComps.status, "playing"),
        inArray(matchplayMatches.status, ["to-play", "disputed"]),
      ),
    );
}

export async function markMatchReminded(db: Database, id: string, now: Date) {
  await db
    .update(matchplayMatches)
    .set({ reminderSentAt: now })
    .where(and(eq(matchplayMatches.id, id), isNull(matchplayMatches.reminderSentAt)));
}

export async function markMatchOverdue(db: Database, id: string, now: Date) {
  await db
    .update(matchplayMatches)
    .set({ overdueNoticeAt: now })
    .where(and(eq(matchplayMatches.id, id), isNull(matchplayMatches.overdueNoticeAt)));
}

/** The size of draw the club's current field would make, for the club's page. */
export function drawSizeFor(entries: number): number {
  return drawSize(Math.max(2, entries));
}
