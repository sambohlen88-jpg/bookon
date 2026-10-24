import { MATCH_REMINDER_DAYS, addPerthDays, perthDate, roundCount, roundName } from "@bookon/core";
import {
  MatchplayProblem,
  cancelComp,
  clubById,
  clubSetResult,
  compById,
  confirmResult,
  createOnlineEntry,
  disputeResult,
  endMpEntry,
  entryCounts,
  eventPaymentSettings,
  finaliseReported,
  listedComp,
  markMatchOverdue,
  markMatchReminded,
  markMpEntryAbandoned,
  markMpEntryPaid,
  matchesForComp,
  mpEntriesToRefund,
  mpEntryById,
  openMatches,
  publishDraw,
  reportResult,
  setMpEntryCheckout,
  staleMpCheckouts,
  type Actor,
  type Advanced,
  type MatchplayComp,
  type MatchplayEntry,
  type MatchplayMatch,
  type MatchplayPlayer,
} from "@bookon/db";
import {
  mpByeEmail,
  mpChampionEmail,
  mpDisputeClubEmail,
  mpEntryClubEmail,
  mpEntryEndedEmail,
  mpEnteredEmail,
  mpMatchEmail,
  mpOverdueClubEmail,
  mpReminderEmail,
  mpResultEmail,
  mpResultReportedEmail,
  type EmailMessage,
} from "@bookon/email";
import { BookingProblem, type LessonContext } from "./bookings";
import { clubInbox, clubTakesEntries } from "./club-events";

/**
 * Match play (Milestone 22): entering (free, or paid to the club), the
 * draw going out, results, and the emails that keep a competition moving.
 */

export function mpManageLink(site: string, entry: Pick<MatchplayEntry, "manageToken">): string {
  return `${site}/matchplay/entry/${entry.manageToken}`;
}

export function compLink(site: string, comp: Pick<MatchplayComp, "id">): string {
  return `${site}/matchplay/${comp.id}`;
}

function portalLink(site: string, comp: Pick<MatchplayComp, "id" | "clubId">): string {
  return `${site}/club/${comp.clubId}/matchplay/${comp.id}`;
}

async function send(ctx: LessonContext, message: EmailMessage): Promise<void> {
  try {
    await ctx.mailer.send(message);
  } catch (error) {
    console.error(`[matchplay] could not email ${message.to}: ${message.subject}`, error);
  }
}

/** Email a side, if they gave an email address. Club-added players may only have a mobile. */
function emailable<T extends { contactEmail: string | null }>(
  entry: T,
): entry is T & { contactEmail: string } {
  return Boolean(entry.contactEmail);
}

async function context(ctx: LessonContext, compId: string) {
  const comp = await listedComp(ctx.db, compId, ctx.now);
  if (!comp) throw new Error(`Competition ${compId} is missing`);
  const club = (await clubById(ctx.db, comp.clubId))!;
  return {
    comp,
    club,
    where: { clubName: comp.clubName, courseLink: `${ctx.site}/courses/${comp.courseSlug}` },
  };
}

/* Entering */

export interface MpEntryRequest {
  comp: MatchplayComp;
  players: MatchplayPlayer[];
  contactEmail: string;
  contactPhone: string;
  userId?: string | null;
}

/** Enter online. Free entries go straight in; paid ones go to the checkout. Returns where to go next. */
export async function startMpEntry(ctx: LessonContext, request: MpEntryRequest): Promise<string> {
  const { comp } = request;
  const players = request.players.map((p) => ({ name: p.name.trim().slice(0, 80) }));
  if (players.length !== comp.teamSize || players.some((p) => !p.name))
    throw new BookingProblem(comp.teamSize === 2 ? "Add both players' names." : "Add your name.");
  const feesCents = comp.feeCents * comp.teamSize;
  const club = (await clubById(ctx.db, comp.clubId))!;
  if (feesCents > 0 && !(await clubTakesEntries(ctx, club)))
    throw new BookingProblem("This club isn't taking paid entries through BookOn right now.");
  const { feeCents } = await eventPaymentSettings(ctx.db);
  let entry: MatchplayEntry;
  try {
    entry = await createOnlineEntry(
      ctx.db,
      {
        compId: comp.id,
        players,
        contactName: players[0]!.name,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone,
        userId: request.userId,
        feesCents,
        bookingFeeCents: feeCents,
        provider: ctx.payments.kind,
      },
      ctx.now,
    );
  } catch (error) {
    if (error instanceof MatchplayProblem) throw new BookingProblem(error.message);
    throw error;
  }
  if (entry.status === "entered") {
    await tellEntered(ctx, entry);
    return `${mpManageLink(ctx.site, entry)}?entered=1`;
  }
  try {
    const checkout = await ctx.payments.createCheckout({
      bookingId: entry.id,
      description: `${comp.title} at ${club.name} (${players.map((p) => p.name).join(" & ")})`,
      lessonCents: entry.feesCents,
      feeCents: entry.bookingFeeCents,
      accountId: club.paymentAccountId!,
      email: entry.contactEmail!,
      successUrl: `${mpManageLink(ctx.site, entry)}?paid=1`,
      cancelUrl: `${compLink(ctx.site, comp)}?cancelled=${entry.id}`,
      expiresAt: entry.checkoutExpiresAt!,
      capture: "automatic",
    });
    await setMpEntryCheckout(ctx.db, entry.id, checkout.id);
    return checkout.url;
  } catch (error) {
    await markMpEntryAbandoned(ctx.db, entry.id);
    throw error;
  }
}

async function tellEntered(ctx: LessonContext, entry: MatchplayEntry) {
  const { comp, club, where } = await context(ctx, entry.compId);
  if (emailable(entry))
    await send(
      ctx,
      mpEnteredEmail({ comp, entry, where, manageLink: mpManageLink(ctx.site, entry) }),
    );
  const entered = (await entryCounts(ctx.db, [comp.id], ctx.now)).get(comp.id) ?? 0;
  for (const to of await clubInbox(ctx, club))
    await send(
      ctx,
      mpEntryClubEmail({ to, comp, entry, entered, portalLink: portalLink(ctx.site, comp) }),
    );
}

/** The golfer paid. Safe to call more than once; refunds at once if the competition was cancelled. */
export async function mpEntryPaid(
  ctx: LessonContext,
  entryId: string,
  paymentId: string,
): Promise<MatchplayEntry | null> {
  const entry = await markMpEntryPaid(ctx.db, entryId, paymentId, ctx.now);
  if (!entry) return null;
  const comp = (await compById(ctx.db, entry.compId))!;
  if (comp.status === "cancelled") {
    await refundEntry(ctx, entry, "comp", null);
    return entry;
  }
  await tellEntered(ctx, entry);
  return entry;
}

export async function checkMpCheckout(ctx: LessonContext, entry: MatchplayEntry) {
  if (entry.status !== "checkout" || !entry.checkoutId) return entry;
  if (entry.provider !== ctx.payments.kind) return entry;
  const state = await ctx.payments.checkout(entry.checkoutId);
  if (state.status === "complete" && state.paymentId)
    return (await mpEntryPaid(ctx, entry.id, state.paymentId)) ?? entry;
  return entry;
}

export async function abandonMpCheckout(ctx: LessonContext, entry: MatchplayEntry) {
  if (entry.status !== "checkout") return;
  if (entry.checkoutId && entry.provider === ctx.payments.kind) {
    const state = await ctx.payments.checkout(entry.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await mpEntryPaid(ctx, entry.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(entry.checkoutId);
  }
  await markMpEntryAbandoned(ctx.db, entry.id);
}

/* Withdrawing and cancelling */

/** Money first, then the entry. Paid entries are refunded in full. */
async function refundEntry(
  ctx: LessonContext,
  entry: MatchplayEntry,
  by: "golfer" | "club" | "comp",
  note: string | null,
  refund = true,
): Promise<MatchplayEntry | null> {
  const refundCents = refund && entry.paymentId ? entry.feesCents + entry.bookingFeeCents : 0;
  if (refundCents > 0) await ctx.payments.refund(entry.paymentId!);
  const ended = await endMpEntry(ctx.db, entry.id, { by, refundCents }, ctx.now);
  if (!ended) return null;
  const { comp, where } = await context(ctx, entry.compId);
  if (emailable(entry))
    await send(
      ctx,
      mpEntryEndedEmail({
        comp,
        entry,
        where,
        reason: by,
        refundCents,
        note: note ?? comp.cancelNote,
      }),
    );
  return ended;
}

/** Golfers can withdraw (with a full refund) until the draw is made. */
export async function withdrawMpByGolfer(ctx: LessonContext, entry: MatchplayEntry) {
  const comp = (await compById(ctx.db, entry.compId))!;
  if (entry.status !== "entered" || comp.status !== "entries")
    throw new BookingProblem("The draw has been made, so please contact the club to withdraw.");
  return refundEntry(ctx, entry, "golfer", null);
}

/** The club takes an entry out before the draw, with or without a refund. */
export async function withdrawMpByClub(
  ctx: LessonContext,
  entry: MatchplayEntry,
  options: { refund: boolean; note: string | null },
) {
  const comp = (await compById(ctx.db, entry.compId))!;
  if (entry.status !== "entered" || comp.status !== "entries")
    throw new BookingProblem(
      "The draw has been made. Award a walkover instead, or start the draw again first.",
    );
  return refundEntry(ctx, entry, "club", options.note, options.refund);
}

async function refundCancelledComps(ctx: LessonContext, compId?: string): Promise<number> {
  let done = 0;
  for (const { entry } of await mpEntriesToRefund(ctx.db, compId)) {
    if (entry.paymentId && entry.provider !== ctx.payments.kind) continue;
    try {
      if (await refundEntry(ctx, entry, "comp", null)) done++;
    } catch (error) {
      console.error(`[matchplay] could not refund ${entry.id}`, error);
    }
  }
  return done;
}

/** Cancel a competition: everyone is told, and anyone who paid is refunded in full. */
export async function cancelCompByClub(
  ctx: LessonContext,
  comp: MatchplayComp,
  note: string | null,
  actor: Actor,
) {
  const cancelled = await cancelComp(ctx.db, comp, note, actor, ctx.now);
  if (!cancelled) return null;
  return { told: await refundCancelledComps(ctx, comp.id) };
}

/* The draw and matches */

/** Email both sides of a match their opponent, and the date to play by. */
async function tellMatch(ctx: LessonContext, match: MatchplayMatch) {
  if (!match.entryA || !match.entryB) return;
  const { comp, where } = await context(ctx, match.compId);
  const a = (await mpEntryById(ctx.db, match.entryA))!;
  const b = (await mpEntryById(ctx.db, match.entryB))!;
  const rounds = roundCount(comp.drawSize ?? 2);
  const round = roundName(match.round, rounds);
  const playBy = comp.rounds[match.round - 1]?.playBy ?? null;
  for (const [entry, opponent] of [
    [a, b],
    [b, a],
  ] as const)
    if (emailable(entry))
      await send(
        ctx,
        mpMatchEmail({
          comp,
          entry,
          opponent,
          round,
          playBy,
          where,
          manageLink: mpManageLink(ctx.site, entry),
        }),
      );
}

/** After a result stands: tell both sides, set up the next match, or crown the winner. */
async function afterDecided(
  ctx: LessonContext,
  result: { match: MatchplayMatch; advanced: Advanced },
  byClub: boolean,
) {
  const { match, advanced } = result;
  const { comp, club } = await context(ctx, match.compId);
  const winner = (await mpEntryById(ctx.db, match.winnerEntryId!))!;
  for (const id of [match.entryA, match.entryB]) {
    const side = id ? await mpEntryById(ctx.db, id) : null;
    if (side && emailable(side))
      await send(
        ctx,
        mpResultEmail({
          comp,
          to: side,
          winner,
          score: match.score,
          byClub,
          manageLink: mpManageLink(ctx.site, side),
        }),
      );
  }
  if (advanced.ready) await tellMatch(ctx, advanced.ready);
  if (advanced.champion) {
    const link = compLink(ctx.site, comp);
    for (const to of await clubInbox(ctx, club))
      await send(ctx, mpChampionEmail({ to, comp, winner, link }));
  }
}

/** Publish the draw and email everyone their first match (or their bye). */
export async function publishDrawAndTell(
  ctx: LessonContext,
  comp: MatchplayComp,
  actor: Actor,
): Promise<number> {
  await publishDraw(ctx.db, comp, actor, ctx.now);
  const matches = await matchesForComp(ctx.db, comp.id);
  let told = 0;
  for (const m of matches.filter((m) => m.status === "to-play")) {
    await tellMatch(ctx, m);
    told += 2;
  }
  for (const m of matches.filter((m) => m.round === 1 && m.score === "Bye")) {
    const next = matches.find((n) => n.round === 2 && n.slot === Math.floor(m.slot / 2));
    if (next?.status === "to-play") continue;
    const entry = (await mpEntryById(ctx.db, m.winnerEntryId!))!;
    if (emailable(entry)) {
      await send(ctx, mpByeEmail({ comp, entry, manageLink: mpManageLink(ctx.site, entry) }));
      told++;
    }
  }
  return told;
}

/** One side reports the result; the other is asked to confirm or dispute. */
export async function reportAndTell(
  ctx: LessonContext,
  match: MatchplayMatch,
  by: MatchplayEntry,
  winnerEntryId: string,
  score: string,
) {
  const reported = await reportResult(ctx.db, match, by.id, winnerEntryId, score, ctx.now);
  const { comp } = await context(ctx, match.compId);
  const otherId = reported.entryA === by.id ? reported.entryB! : reported.entryA!;
  const other = (await mpEntryById(ctx.db, otherId))!;
  const winner = winnerEntryId === by.id ? by : other;
  if (emailable(other))
    await send(
      ctx,
      mpResultReportedEmail({
        comp,
        to: other,
        reporter: by,
        winner,
        score: reported.score,
        disputeBy: reported.disputeBy!,
        manageLink: mpManageLink(ctx.site, other),
      }),
    );
  return reported;
}

export async function confirmAndTell(
  ctx: LessonContext,
  match: MatchplayMatch,
  by: MatchplayEntry,
) {
  const result = await confirmResult(ctx.db, match, by.id, ctx.now);
  await afterDecided(ctx, result, false);
  return result.match;
}

export async function disputeAndTell(
  ctx: LessonContext,
  match: MatchplayMatch,
  by: MatchplayEntry,
  note: string | null,
) {
  const disputed = await disputeResult(ctx.db, match, by.id, note, ctx.now);
  const { comp, club } = await context(ctx, match.compId);
  const a = (await mpEntryById(ctx.db, disputed.entryA!))!;
  const b = (await mpEntryById(ctx.db, disputed.entryB!))!;
  const reportedWinner = disputed.winnerEntryId === a.id ? a : b;
  for (const to of await clubInbox(ctx, club))
    await send(
      ctx,
      mpDisputeClubEmail({
        to,
        comp,
        sides: [a, b],
        reportedWinner,
        score: disputed.score,
        note,
        portalLink: portalLink(ctx.site, comp),
      }),
    );
  return disputed;
}

/** The club records a result or awards a walkover. */
export async function clubResultAndTell(
  ctx: LessonContext,
  match: MatchplayMatch,
  winnerEntryId: string,
  score: string,
) {
  const result = await clubSetResult(ctx.db, match, winnerEntryId, score, ctx.now);
  await afterDecided(ctx, result, true);
  return result.match;
}

/* Worker */

async function closeMpCheckout(ctx: LessonContext, entry: MatchplayEntry) {
  if (entry.checkoutId && entry.provider === ctx.payments.kind && ctx.payments.kind === "stripe") {
    const state = await ctx.payments.checkout(entry.checkoutId);
    if (state.status === "complete" && state.paymentId) {
      await mpEntryPaid(ctx, entry.id, state.paymentId);
      return;
    }
    if (state.status === "open") await ctx.payments.expireCheckout(entry.checkoutId);
  }
  await markMpEntryAbandoned(ctx.db, entry.id);
}

/**
 * Run often (the worker does): let undisputed results stand after 48 hours,
 * remind players before the play-by date, tell clubs about overdue matches,
 * close unpaid checkouts and refund anyone in a cancelled competition.
 */
export async function tidyMatchplay(ctx: LessonContext) {
  let closed = 0;
  for (const entry of await staleMpCheckouts(ctx.db, ctx.now)) {
    try {
      await closeMpCheckout(ctx, entry);
      closed++;
    } catch (error) {
      console.error(`[matchplay] could not close checkout for ${entry.id}`, error);
    }
  }
  const decided = await finaliseReported(ctx.db, ctx.now);
  for (const result of decided) await afterDecided(ctx, result, false);

  const today = perthDate(ctx.now);
  let reminders = 0;
  let overdue = 0;
  for (const { match, comp } of await openMatches(ctx.db)) {
    const playBy = comp.rounds[match.round - 1]?.playBy;
    if (!playBy || !match.entryA || !match.entryB) continue;
    try {
      const { where, club } = await context(ctx, comp.id);
      const a = (await mpEntryById(ctx.db, match.entryA))!;
      const b = (await mpEntryById(ctx.db, match.entryB))!;
      if (
        match.status === "to-play" &&
        !match.reminderSentAt &&
        today >= addPerthDays(playBy, -MATCH_REMINDER_DAYS) &&
        today <= playBy
      ) {
        for (const [entry, opponent] of [
          [a, b],
          [b, a],
        ] as const)
          if (emailable(entry))
            await send(
              ctx,
              mpReminderEmail({
                comp,
                entry,
                opponent,
                playBy,
                where,
                manageLink: mpManageLink(ctx.site, entry),
              }),
            );
        await markMatchReminded(ctx.db, match.id, ctx.now);
        reminders++;
      }
      if (today > playBy && !match.overdueNoticeAt) {
        for (const to of await clubInbox(ctx, club))
          await send(
            ctx,
            mpOverdueClubEmail({
              to,
              comp,
              sides: [a, b],
              playBy,
              disputed: match.status === "disputed",
              portalLink: portalLink(ctx.site, comp),
            }),
          );
        await markMatchOverdue(ctx.db, match.id, ctx.now);
        overdue++;
      }
    } catch (error) {
      console.error(`[matchplay] could not check match ${match.id}`, error);
    }
  }
  const refunded = await refundCancelledComps(ctx);
  return { closed, decided: decided.length, reminders, overdue, refunded };
}
