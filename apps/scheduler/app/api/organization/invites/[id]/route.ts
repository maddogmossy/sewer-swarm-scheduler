import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// DELETE /api/organization/invites/[id] - Delete an invite
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
        { error: "Only admins can delete invites" },
        { status: 403 }
      );
    }

    // Verify invite belongs to current organization
    const invite = await storage.getInviteById(id);
    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }
    if (invite.organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    await storage.deleteInvite(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to delete invite" },
      { status: 500 }
    );
  }
}

