import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";
import type { MemberRole } from "@/shared/schema";

export const runtime = "nodejs";

// PATCH /api/organization/members/[id]/role - Update a member's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    const { id } = await params;
    
    // Check if user is admin
    if (ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update member roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role } = body;

    const validRoles: MemberRole[] = ["admin", "operations", "user"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the membership to verify it belongs to the current organization
    const membership = await storage.getMembershipById(id);
    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    if (membership.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const updatedMembership = await storage.updateMembershipRole(id, role);
    if (!updatedMembership) {
      return NextResponse.json(
        { error: "Failed to update role" },
        { status: 500 }
      );
    }

    // Fetch user details for the response
    const user = await storage.getUser(updatedMembership.userId);
    return NextResponse.json({
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      username: user?.username || "Unknown",
      email: user?.email || "",
      role: updatedMembership.role,
      acceptedAt: updatedMembership.acceptedAt,
    });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to update role" },
      { status: 500 }
    );
  }
}

