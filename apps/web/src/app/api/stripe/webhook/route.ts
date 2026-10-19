import { handlePaymentEvent } from "@bookon/payments";
import { lessonContext } from "@/lib/lessons";

export const dynamic = "force-dynamic";

/**
 * Stripe tells BookOn when a golfer pays at checkout, a checkout expires, or
 * a coach's account changes. Only events signed with STRIPE_WEBHOOK_SECRET
 * are read. In the Stripe dashboard, send checkout.session.completed,
 * checkout.session.expired and (for connected accounts) account.updated here.
 */
export async function POST(request: Request) {
  const ctx = await lessonContext();
  if (!ctx || ctx.payments.kind !== "stripe") return new Response("Not found", { status: 404 });
  const body = await request.text();
  let event;
  try {
    event = ctx.payments.readWebhook(body, request.headers.get("stripe-signature"));
  } catch (error) {
    console.error("[payments] rejected a webhook", error instanceof Error ? error.message : error);
    return new Response("Bad signature", { status: 400 });
  }
  try {
    await handlePaymentEvent(ctx, event);
  } catch (error) {
    // Stripe tries again later.
    console.error(`[payments] could not handle ${event.type}`, error);
    return new Response("Try again", { status: 500 });
  }
  return Response.json({ received: true });
}
