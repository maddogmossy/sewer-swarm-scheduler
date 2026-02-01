import { NextResponse } from "next/server";
import { getStripePublishableKey } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const publishableKey = getStripePublishableKey();
    
    if (!publishableKey) {
      return NextResponse.json(
        { error: "Stripe publishable key is not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json({ publishableKey });
  } catch (error: any) {
    console.error("Failed to get Stripe config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get Stripe configuration" },
      { status: 500 }
    );
  }
}

