import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { PaymentError, PracticePayments, StripePayments, usableAccount } from "./provider";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/stripe/${name}.json`, import.meta.url), "utf8");

interface Call {
  method: string;
  path: string;
  body: URLSearchParams;
  idempotencyKey: string | null;
}

/** Answers Stripe's API from saved responses, keyed by "METHOD /path", and records each request. */
function fakeStripe(responses: Record<string, string | { status: number; body: string }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path: url.pathname,
      body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
      idempotencyKey: headers.get("idempotency-key"),
    });
    const answer = responses[`${method} ${url.pathname}`];
    if (answer === undefined) throw new Error(`No saved response for ${method} ${url.pathname}`);
    const { status, body } = typeof answer === "string" ? { status: 200, body: answer } : answer;
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, stripe: new StripePayments("sk_test_123", "whsec_test", fetchImpl) };
}

describe("StripePayments", () => {
  it("opens a checkout that holds the card, pays the coach and keeps the fee", async () => {
    const { calls, stripe } = fakeStripe({
      "POST /v1/checkout/sessions": fixture("checkout-session-open"),
    });
    const expiresAt = new Date("2026-10-18T02:30:00Z");
    const result = await stripe.createCheckout({
      bookingId: "booking-id",
      description: "Private lesson, 60 min with Mia Hartley, Sat 24 Oct, 9:00 am",
      lessonCents: 9000,
      feeCents: 250,
      accountId: "acct_1QcoachMia",
      email: "golfer@example.com",
      successUrl: "http://localhost:3000/lessons/abc?paid=1",
      cancelUrl: "http://localhost:3000/coaches/mia-hartley/book",
      expiresAt,
    });
    expect(result).toEqual({
      id: "cs_test_a1lesson",
      url: "https://checkout.stripe.com/c/pay/cs_test_a1lesson",
    });
    const { body, idempotencyKey } = calls[0]!;
    expect(body.get("mode")).toBe("payment");
    expect(body.get("payment_intent_data[capture_method]")).toBe("manual");
    expect(body.get("payment_intent_data[application_fee_amount]")).toBe("250");
    expect(body.get("payment_intent_data[transfer_data][destination]")).toBe("acct_1QcoachMia");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("9000");
    expect(body.get("line_items[0][price_data][currency]")).toBe("aud");
    expect(body.get("line_items[1][price_data][unit_amount]")).toBe("250");
    expect(body.get("line_items[1][price_data][product_data][name]")).toBe("BookOn booking fee");
    expect(body.get("expires_at")).toBe(String(expiresAt.getTime() / 1000));
    expect(body.get("customer_email")).toBe("golfer@example.com");
    expect(idempotencyKey).toBe("checkout-booking-id");
  });

  it("reads whether a checkout was paid", async () => {
    const open = fakeStripe({
      "GET /v1/checkout/sessions/cs_test_a1lesson": fixture("checkout-session-open"),
    });
    expect(await open.stripe.checkout("cs_test_a1lesson")).toEqual({
      status: "open",
      paymentId: null,
    });
    const paid = fakeStripe({
      "GET /v1/checkout/sessions/cs_test_a1lesson": fixture("checkout-session-complete"),
    });
    expect(await paid.stripe.checkout("cs_test_a1lesson")).toEqual({
      status: "complete",
      paymentId: "pi_3Qlesson",
    });
  });

  it("charges, releases and refunds in full", async () => {
    const { calls, stripe } = fakeStripe({
      "POST /v1/payment_intents/pi_3Qlesson/capture": fixture("payment-intent-captured"),
      "GET /v1/payment_intents/pi_3Qlesson": fixture("payment-intent-held"),
      "POST /v1/payment_intents/pi_3Qlesson/cancel": fixture("payment-intent-canceled"),
      "POST /v1/refunds": fixture("refund"),
    });
    await stripe.capture("pi_3Qlesson");
    await stripe.release("pi_3Qlesson");
    await stripe.refund("pi_3Qlesson");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /v1/payment_intents/pi_3Qlesson/capture",
      "GET /v1/payment_intents/pi_3Qlesson",
      "POST /v1/payment_intents/pi_3Qlesson/cancel",
      "POST /v1/refunds",
    ]);
    const refund = calls[3]!.body;
    expect(refund.get("payment_intent")).toBe("pi_3Qlesson");
    expect(refund.get("reverse_transfer")).toBe("true");
    expect(refund.get("refund_application_fee")).toBe("true");
  });

  it("doesn't release a hold that's already gone", async () => {
    const { calls, stripe } = fakeStripe({
      "GET /v1/payment_intents/pi_3Qlesson": fixture("payment-intent-canceled"),
    });
    await stripe.release("pi_3Qlesson");
    expect(calls).toHaveLength(1);
  });

  it("turns Stripe's errors into a message people can read", async () => {
    const { stripe } = fakeStripe({
      "POST /v1/payment_intents/pi_3Qlesson/capture": {
        status: 400,
        body: fixture("error-capture-canceled"),
      },
    });
    const error = await stripe.capture("pi_3Qlesson").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentError);
    expect((error as Error).message).toBe(
      "Stripe couldn't charge the card. Please try again in a minute.",
    );
  });

  it("sets up Express accounts in Australia and reads when they're ready", async () => {
    const { calls, stripe } = fakeStripe({
      "POST /v1/accounts": fixture("account-new"),
      "POST /v1/account_links": fixture("account-link"),
      "GET /v1/accounts/acct_1QcoachMia": fixture("account-ready"),
    });
    expect(await stripe.createAccount({ email: "mia@coach.test", name: "Mia Hartley" })).toBe(
      "acct_1QcoachMia",
    );
    expect(calls[0]!.body.get("type")).toBe("express");
    expect(calls[0]!.body.get("country")).toBe("AU");
    expect(calls[0]!.body.get("capabilities[transfers][requested]")).toBe("true");
    expect(
      await stripe.onboardingLink("acct_1QcoachMia", {
        returnUrl: "http://localhost:3000/coach/payments",
        refreshUrl: "http://localhost:3000/coach/payments?again=1",
      }),
    ).toBe("https://connect.stripe.com/setup/e/acct_1QcoachMia/abc123");
    expect(calls[1]!.body.get("type")).toBe("account_onboarding");
    expect(await stripe.accountReady("acct_1QcoachMia")).toBe(true);
  });

  it("only believes webhooks signed with BookOn's secret", () => {
    const { stripe } = fakeStripe({});
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: { object: JSON.parse(fixture("checkout-session-complete")) },
    });
    const signed = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    expect(stripe.readWebhook(payload, signed)).toEqual({
      type: "checkout.complete",
      checkoutId: "cs_test_a1lesson",
      paymentId: "pi_3Qlesson",
    });
    const forged = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    expect(() => stripe.readWebhook(payload, forged)).toThrow();
    expect(() => stripe.readWebhook(payload, null)).toThrow(PaymentError);

    const account = JSON.stringify({
      id: "evt_2",
      object: "event",
      type: "account.updated",
      data: { object: JSON.parse(fixture("account-ready")) },
    });
    expect(
      stripe.readWebhook(
        account,
        Stripe.webhooks.generateTestHeaderString({ payload: account, secret: "whsec_test" }),
      ),
    ).toEqual({ type: "account.updated", accountId: "acct_1QcoachMia", ready: true });
  });
});

describe("usableAccount", () => {
  it("never mixes practice accounts with real Stripe", () => {
    const practice = new PracticePayments("http://localhost:3000");
    const { stripe } = fakeStripe({});
    expect(usableAccount(practice, "practice_acct_mia")).toBe(true);
    expect(usableAccount(practice, "acct_1QcoachMia")).toBe(false);
    expect(usableAccount(stripe, "practice_acct_mia")).toBe(false);
    expect(usableAccount(stripe, "acct_1QcoachMia")).toBe(true);
    expect(usableAccount(stripe, null)).toBe(false);
  });
});
