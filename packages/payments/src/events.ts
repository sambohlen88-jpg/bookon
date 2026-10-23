import {
  entryByCheckout,
  groupBookingByCheckout,
  lessonByCheckout,
  markEntryAbandoned,
  markGroupAbandoned,
  markLessonAbandoned,
  setClubPaymentsReady,
  setCoachPaymentsReady,
} from "@bookon/db";
import { lessonPaid, type LessonContext } from "./bookings";
import { entryPaid } from "./club-events";
import { groupPaid } from "./groups";
import type { WebhookEvent } from "./provider";

/** Act on a webhook from Stripe, for a lesson, a group session booking or an event entry. */
export async function handlePaymentEvent(ctx: LessonContext, event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "checkout.complete": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) {
        await lessonPaid(ctx, booking.id, event.paymentId);
        return;
      }
      const group = await groupBookingByCheckout(ctx.db, event.checkoutId);
      if (group) {
        await groupPaid(ctx, group.id, event.paymentId);
        return;
      }
      const entry = await entryByCheckout(ctx.db, event.checkoutId);
      if (entry) await entryPaid(ctx, entry.id, event.paymentId);
      return;
    }
    case "checkout.expired": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) {
        await markLessonAbandoned(ctx.db, booking.id);
        return;
      }
      const group = await groupBookingByCheckout(ctx.db, event.checkoutId);
      if (group) {
        await markGroupAbandoned(ctx.db, group.id);
        return;
      }
      const entry = await entryByCheckout(ctx.db, event.checkoutId);
      if (entry) await markEntryAbandoned(ctx.db, entry.id);
      return;
    }
    case "account.updated":
      // A coach's or a club's account.
      await setCoachPaymentsReady(ctx.db, event.accountId, event.ready, ctx.now);
      await setClubPaymentsReady(ctx.db, event.accountId, event.ready, ctx.now);
      return;
    case "ignored":
      return;
  }
}
