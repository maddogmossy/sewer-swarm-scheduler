import Stripe from "stripe";

/**
 * Get Stripe secret key based on environment
 * Uses test keys in development, production keys in production
 */
function getStripeSecretKey(): string | undefined {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: use STRIPE_SECRET_KEY_LIVE or fallback to STRIPE_SECRET_KEY
    return process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
  } else {
    // Development: use STRIPE_SECRET_KEY_TEST or fallback to STRIPE_SECRET_KEY
    return process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
  }
}

/**
 * Get Stripe publishable key based on environment
 * Used for frontend Stripe.js integration
 */
export function getStripePublishableKey(): string | undefined {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: use STRIPE_PUBLISHABLE_KEY_LIVE or fallback to STRIPE_PUBLISHABLE_KEY
    return process.env.STRIPE_PUBLISHABLE_KEY_LIVE || process.env.STRIPE_PUBLISHABLE_KEY;
  } else {
    // Development: use STRIPE_PUBLISHABLE_KEY_TEST or fallback to STRIPE_PUBLISHABLE_KEY
    return process.env.STRIPE_PUBLISHABLE_KEY_TEST || process.env.STRIPE_PUBLISHABLE_KEY;
  }
}

/**
 * Stripe client
 * Uses standard Stripe SDK (no Replit connectors)
 * Automatically selects test or production keys based on NODE_ENV
 */
const secretKey = getStripeSecretKey();
export const stripe = secretKey
  ? new Stripe(secretKey, {
      apiVersion: "2024-04-10",
    })
  : null;

/**
 * Environment safety check
 */
export function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set. Stripe features are disabled.");
  }
  if (!stripe) {
    throw new Error("Stripe client is not initialized. Please set STRIPE_SECRET_KEY in your environment variables.");
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
  
  if (!stripe) {
    throw new Error("Stripe client is not initialized");
  }

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
  
  if (!stripe) {
    throw new Error("Stripe client is not initialized");
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
