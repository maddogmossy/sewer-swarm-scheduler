import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// DELETE /api/organization/members/[id] - Remove a member from the organization
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    const { id } = await params;
    
    // Check if user is admin
    if (ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can remove members" },
        { status: 403 }
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

    // Don't allow removing yourself
    if (membership.userId === ctx.userId) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 400 }
      );
    }

    await storage.deleteMembership(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to remove member" },
      { status: 500 }
    );
  }
}

