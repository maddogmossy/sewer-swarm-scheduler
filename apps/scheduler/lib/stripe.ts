import Stripe from "stripe";

/**
 * Stripe client
 * Uses standard Stripe SDK (no Replit connectors)
 */
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2024-04-10",
  }
);

/**
 * Environment safety check
 */
export function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
}

/**
 * Create a checkout session
 * (logic copied from Replit version, framework-agnostic)
 */
export async function createCheckoutSession(params: {
  customerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  assertStripeConfigured();

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
}

/**
 * Verify and construct Stripe webhook event
 * Raw body MUST be provided by API route later
 */
export function constructStripeEvent(
  rawBody: Buffer,
  signature: string
): Stripe.Event {
  assertStripeConfigured();

  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
