import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// POST /api/organization/invites/[id]/resend - Resend an invite (regenerate token)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    const { id } = await params;
    
    // Check if user is admin
    if (ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can resend invites" },
        { status: 403 }
      );
    }

    // Verify invite belongs to current organization
    const existingInvite = await storage.getInviteById(id);
    if (!existingInvite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }
    if (existingInvite.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Generate new token and extend expiry
    const newToken = `${ctx.organizationId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const updatedInvite = await storage.updateInvite(id, {
      token: newToken,
      expiresAt: newExpiresAt,
    });

    if (!updatedInvite) {
      return NextResponse.json(
        { error: "Failed to update invite" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedInvite);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error resending invite:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to resend invite" },
      { status: 500 }
    );
  }
}

