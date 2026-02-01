import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    
    const organization = await storage.getOrganization(ctx.organizationId);
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get membership to get role
    const memberships = await storage.getMembershipsByUser(ctx.userId);
    const primaryMembership = memberships.find(m => m.organizationId === ctx.organizationId) || memberships[0];

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus || "trialing",
      membershipRole: primaryMembership?.role || "user",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: err.message?.includes("Unauthorized") ? 401 : 403 }
    );
  }
}

