import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// GET /api/invites/[token] - Get invite information by token
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Find invite by token
    const invite = await storage.getInviteByToken(token);
    
    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if invite has expired
    if (new Date() > new Date(invite.expiresAt)) {
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Get organization info
    const organization = await storage.getOrganization(invite.organizationId);
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await storage.getUserByEmail(invite.email);
    
    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      organizationName: organization.name,
      organizationId: organization.id,
      userExists: !!existingUser,
      expiresAt: invite.expiresAt,
    });
  } catch (err: any) {
    console.error("Error fetching invite:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch invite" },
      { status: 500 }
    );
  }
}
