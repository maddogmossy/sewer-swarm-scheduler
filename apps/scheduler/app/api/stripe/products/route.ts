import { NextResponse } from "next/server";
import { stripe, assertStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    // If Stripe is not configured, return empty products array
    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      return NextResponse.json({ data: [] });
    }
    
    assertStripeConfigured();
    
    // Fetch all active products
    const products = await stripe!.products.list({
      active: true,
      limit: 100,
    });

    // Fetch prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe!.prices.list({
          product: product.id,
          active: true,
        });

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          metadata: product.metadata,
          prices: prices.data.map((price) => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            active: price.active,
            metadata: price.metadata,
          })),
        };
      })
    );

    return NextResponse.json({ data: productsWithPrices });
  } catch (error: any) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

