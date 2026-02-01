import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";
import { stripe, assertStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertStripeConfigured();
    const ctx = await getRequestContext();
    
    const body = await req.json();
    const { priceId, trialDays } = body;
    
    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID required" },
        { status: 400 }
      );
    }

    // Get user
    const user = await storage.getUser(ctx.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      if (!stripe) {
        throw new Error("Stripe client is not initialized");
      }
      const customer = await stripe.customers.create({
        email: user.email || `${user.username}@sewerswarm.app`,
        name: user.username,
        metadata: { userId: user.id },
      });
      
      await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    // Create checkout session with trial if specified
    const baseUrl = req.headers.get("origin") || "http://localhost:3000";
    const sessionParams: any = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/schedule?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
    };

    if (trialDays && trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: trialDays,
      };
    }

    if (!stripe) {
      throw new Error("Stripe client is not initialized");
    }
    
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Failed to create checkout:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

