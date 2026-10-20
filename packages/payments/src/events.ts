import {
  groupBookingByCheckout,
  lessonByCheckout,
  markGroupAbandoned,
  markLessonAbandoned,
  setCoachPaymentsReady,
} from "@bookon/db";
import { lessonPaid, type LessonContext } from "./bookings";
import { groupPaid } from "./groups";
import type { WebhookEvent } from "./provider";

/** Act on a webhook from Stripe, for a lesson or a group session booking. */
export async function handlePaymentEvent(ctx: LessonContext, event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "checkout.complete": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) {
        await lessonPaid(ctx, booking.id, event.paymentId);
        return;
      }
      const group = await groupBookingByCheckout(ctx.db, event.checkoutId);
      if (group) await groupPaid(ctx, group.id, event.paymentId);
      return;
    }
    case "checkout.expired": {
      const booking = await lessonByCheckout(ctx.db, event.checkoutId);
      if (booking) {
        await markLessonAbandoned(ctx.db, booking.id);
        return;
      }
      const group = await groupBookingByCheckout(ctx.db, event.checkoutId);
      if (group) await markGroupAbandoned(ctx.db, group.id);
      return;
    }
    case "account.updated":
      await setCoachPaymentsReady(ctx.db, event.accountId, event.ready, ctx.now);
      return;
    case "ignored":
      return;
  }
}
