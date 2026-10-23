import Stripe from "stripe";

/**
 * Taking money for lessons (Milestone 15). Stripe Connect does the real work:
 * each coach has their own Stripe account (Stripe collects their ID and bank
 * details, never BookOn), golfers pay on Stripe's checkout page, and Stripe
 * pays the coach. "Practice" stands in for Stripe on a local database with no
 * keys, so the whole flow can be clicked through without moving any money.
 */
export interface PaymentProvider {
  readonly kind: "stripe" | "practice";
  /** Start a coach's or club's payment account. */
  createAccount(input: AccountInput): Promise<string>;
  /** Where the coach fills in their details. */
  onboardingLink(
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ): Promise<string>;
  /** Whether the account can take payments and pay out yet. */
  accountReady(accountId: string): Promise<boolean>;
  /** The coach's own payments dashboard. */
  dashboardLink(accountId: string): Promise<string>;
  /** A checkout page that holds the golfer's card (lessons) or charges it (group sessions). */
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  checkout(id: string): Promise<CheckoutState>;
  /** Close a checkout page so it can't be paid any more. */
  expireCheckout(id: string): Promise<void>;
  /** Charge a held card. */
  capture(paymentId: string): Promise<void>;
  /** Let go of a held card without charging it. */
  release(paymentId: string): Promise<void>;
  /** Give back a charge in full: the coach's share and BookOn's fee. */
  refund(paymentId: string): Promise<void>;
  /** Check a webhook really came from the provider and read it. Throws if it didn't. */
  readWebhook(body: string, signature: string | null): WebhookEvent;
}

export interface AccountInput {
  email: string;
  name: string;
  /** "coach" (lessons) or "club" (event entries, Milestone 21). */
  kind?: "coach" | "club";
}

export interface CheckoutInput {
  bookingId: string;
  /** e.g. "Private lesson (60 min) with Mia Hartley, Sat 24 Oct 9:00 am". */
  description: string;
  /** What the coach gets: the lesson, or all the spots at a group session. */
  lessonCents: number;
  feeCents: number;
  /** The coach's account, which gets the lesson price. */
  accountId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  /**
   * "manual" (the default) holds the card until the coach accepts, for
   * lessons. "automatic" charges straight away, for group sessions.
   */
  capture?: "manual" | "automatic";
}

export interface CheckoutState {
  status: "open" | "complete" | "expired";
  /** The held payment, once the golfer has paid. */
  paymentId: string | null;
}

export type WebhookEvent =
  | { type: "checkout.complete"; checkoutId: string; paymentId: string }
  | { type: "checkout.expired"; checkoutId: string }
  | { type: "account.updated"; accountId: string; ready: boolean }
  | { type: "ignored"; name: string };

/** Something went wrong with the payment provider; the message is safe to show. */
export class PaymentError extends Error {}

/** Practice accounts and payments start with this, so real Stripe never sees them. */
export const PRACTICE_PREFIX = "practice_";

/** Whether this provider can take payments for the account. */
export function usableAccount(provider: PaymentProvider, accountId: string | null): boolean {
  if (!accountId) return false;
  return (provider.kind === "practice") === accountId.startsWith(PRACTICE_PREFIX);
}

/* Stripe */

export class StripePayments implements PaymentProvider {
  readonly kind = "stripe" as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string | null,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(fetchImpl),
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: "BookOn" },
    });
  }

  private async call<T>(what: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      console.error(`[payments] Stripe couldn't ${what}`, error);
      throw new PaymentError(`Stripe couldn't ${what}. Please try again in a minute.`);
    }
  }

  async createAccount(input: AccountInput): Promise<string> {
    const club = input.kind === "club";
    const account = await this.call("start the payment account", () =>
      this.stripe.accounts.create({
        type: "express",
        country: "AU",
        email: input.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        // Stripe's own setup asks the coach for their industry and the rest.
        business_profile: {
          product_description: club
            ? `Golf event entries at ${input.name}, through BookOn`
            : `Golf lessons with ${input.name}, booked through BookOn`,
        },
        metadata: { bookon: club ? "club" : "coach" },
      }),
    );
    return account.id;
  }

  async onboardingLink(
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ): Promise<string> {
    const link = await this.call("open the payment setup", () =>
      this.stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        return_url: urls.returnUrl,
        refresh_url: urls.refreshUrl,
      }),
    );
    return link.url;
  }

  async accountReady(accountId: string): Promise<boolean> {
    const account = await this.call("check the payment account", () =>
      this.stripe.accounts.retrieve(accountId),
    );
    return readyAccount(account);
  }

  async dashboardLink(accountId: string): Promise<string> {
    const link = await this.call("open the Stripe dashboard", () =>
      this.stripe.accounts.createLoginLink(accountId),
    );
    return link.url;
  }

  async createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }> {
    const session = await this.call("open the checkout", () =>
      this.stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: input.email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "aud",
                unit_amount: input.lessonCents,
                product_data: { name: input.description },
              },
            },
            // Left off when an admin sets the fee to $0.
            ...(input.feeCents > 0
              ? [
                  {
                    quantity: 1,
                    price_data: {
                      currency: "aud",
                      unit_amount: input.feeCents,
                      product_data: { name: "BookOn booking fee" },
                    },
                  },
                ]
              : []),
          ],
          payment_intent_data: {
            // Lessons: held, not charged, until the coach accepts.
            capture_method: input.capture ?? "manual",
            ...(input.feeCents > 0 ? { application_fee_amount: input.feeCents } : {}),
            transfer_data: { destination: input.accountId },
            description: input.description,
            metadata: { booking: input.bookingId },
          },
          metadata: { booking: input.bookingId },
          client_reference_id: input.bookingId,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
        // One checkout per booking, even if the button is pressed twice.
        { idempotencyKey: `checkout-${input.bookingId}` },
      ),
    );
    if (!session.url)
      throw new PaymentError("Stripe didn't give a checkout page. Please try again.");
    return { id: session.id, url: session.url };
  }

  async checkout(id: string): Promise<CheckoutState> {
    const session = await this.call("check the payment", () =>
      this.stripe.checkout.sessions.retrieve(id),
    );
    return checkoutState(session);
  }

  async expireCheckout(id: string): Promise<void> {
    const session = await this.call("check the payment", () =>
      this.stripe.checkout.sessions.retrieve(id),
    );
    if (session.status !== "open") return;
    await this.call("close the checkout", () => this.stripe.checkout.sessions.expire(id));
  }

  async capture(paymentId: string): Promise<void> {
    await this.call("charge the card", () => this.stripe.paymentIntents.capture(paymentId));
  }

  async release(paymentId: string): Promise<void> {
    const intent = await this.call("check the payment", () =>
      this.stripe.paymentIntents.retrieve(paymentId),
    );
    // Already released (for example, the hold ran out).
    if (intent.status === "canceled") return;
    await this.call("release the card", () => this.stripe.paymentIntents.cancel(paymentId));
  }

  async refund(paymentId: string): Promise<void> {
    await this.call("refund the payment", () =>
      this.stripe.refunds.create(
        {
          payment_intent: paymentId,
          // Take the lesson price back from the coach, and give back BookOn's fee.
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: `refund-${paymentId}` },
      ),
    );
  }

  readWebhook(body: string, signature: string | null): WebhookEvent {
    if (!this.webhookSecret) throw new PaymentError("STRIPE_WEBHOOK_SECRET isn't set");
    if (!signature) throw new PaymentError("No Stripe signature");
    const event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const state = checkoutState(event.data.object);
        return state.status === "complete" && state.paymentId
          ? {
              type: "checkout.complete",
              checkoutId: event.data.object.id,
              paymentId: state.paymentId,
            }
          : { type: "ignored", name: event.type };
      }
      case "checkout.session.expired":
        return { type: "checkout.expired", checkoutId: event.data.object.id };
      case "account.updated":
        return {
          type: "account.updated",
          accountId: event.data.object.id,
          ready: readyAccount(event.data.object),
        };
      default:
        return { type: "ignored", name: event.type };
    }
  }
}

function readyAccount(account: Stripe.Account): boolean {
  return Boolean(account.charges_enabled && account.payouts_enabled && account.details_submitted);
}

function checkoutState(session: Stripe.Checkout.Session): CheckoutState {
  const paymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  return {
    status:
      session.status === "complete"
        ? "complete"
        : session.status === "expired"
          ? "expired"
          : "open",
    paymentId: session.status === "complete" ? paymentId : null,
  };
}

/* Practice */

/**
 * Stands in for Stripe on a local database with no keys. Checkout and setup
 * are pages on BookOn marked "Practice", and nothing is charged.
 */
export class PracticePayments implements PaymentProvider {
  readonly kind = "practice" as const;

  constructor(private readonly site: string) {}

  async createAccount(input: AccountInput): Promise<string> {
    const who = input.kind === "club" ? `club_${input.name}` : input.email;
    return `${PRACTICE_PREFIX}acct_${who.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}`;
  }

  async onboardingLink(_accountId: string, urls: { returnUrl: string }): Promise<string> {
    // Back to the same page on this site, as a path, so the practice page can't send anyone elsewhere.
    const back = new URL(urls.returnUrl);
    return `${this.site}/dev/practice-setup?return=${encodeURIComponent(back.pathname + back.search)}`;
  }

  async accountReady(accountId: string): Promise<boolean> {
    return accountId.startsWith(PRACTICE_PREFIX);
  }

  async dashboardLink(): Promise<string> {
    return `${this.site}/dev/practice-setup?dashboard=1`;
  }

  async createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }> {
    return {
      id: `${PRACTICE_PREFIX}cs_${input.bookingId}`,
      url: `${this.site}/dev/practice-pay/${input.bookingId}`,
    };
  }

  /** Practice payments are recorded by the practice checkout page itself. */
  async checkout(): Promise<CheckoutState> {
    return { status: "open", paymentId: null };
  }

  async expireCheckout(): Promise<void> {}
  async capture(): Promise<void> {}
  async release(): Promise<void> {}
  async refund(): Promise<void> {}

  readWebhook(): WebhookEvent {
    throw new PaymentError("Practice payments don't send webhooks");
  }
}

/**
 * Stripe when STRIPE_SECRET_KEY is set; practice on a local database;
 * otherwise null, and lesson payments are off.
 */
export function paymentProvider(
  env: NodeJS.ProcessEnv,
  options: { site: string; localDatabase: boolean },
): PaymentProvider | null {
  if (env.STRIPE_SECRET_KEY) {
    return new StripePayments(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET || null);
  }
  return options.localDatabase ? new PracticePayments(options.site) : null;
}
