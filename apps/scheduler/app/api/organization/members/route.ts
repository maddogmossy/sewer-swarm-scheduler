import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// GET /api/organization/members - Get all members of the organization
export async function GET() {
  try {
    const ctx = await getRequestContext();
    
    const memberships = await storage.getMembershipsByUser(ctx.userId);
    if (memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 }
      );
    }
    
    // Get the primary membership (first one, or the one matching the organization)
    const membership = memberships.find(m => m.organizationId === ctx.organizationId) || memberships[0];
    const members = await storage.getMembershipsByOrg(membership.organizationId);
    
    // Fetch user details for each member
    const membersWithUsers = await Promise.all(
      members.map(async (m) => {
        const user = await storage.getUser(m.userId);
        return {
          id: m.id,
          userId: m.userId,
          username: user?.username || "Unknown",
          email: user?.email || "",
          role: m.role,
          acceptedAt: m.acceptedAt,
        };
      })
    );
    
    return NextResponse.json(membersWithUsers);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch members" },
      { status: 500 }
    );
  }
}

