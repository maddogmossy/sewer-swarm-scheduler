import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { storage } from "@/lib/storage";
import { canInviteMember } from "@/lib/quota";
import { sendEmail, generateInviteEmailHtml } from "@/lib/email";
import type { MemberRole } from "@/shared/schema";

export const runtime = "nodejs";

// GET /api/organization/invites - Get all invites for the organization
export async function GET() {
  try {
    const ctx = await getRequestContext();
    
    // Check if user is admin
    if (ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can view invites" },
        { status: 403 }
      );
    }

    const invites = await storage.getInvitesByOrg(ctx.organizationId);
    return NextResponse.json(invites);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

// POST /api/organization/invites - Create a new invite
export async function POST(request: Request) {
  try {
    const ctx = await getRequestContext();
    
    // Check if user is admin
    if (ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create invites" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const validRoles: MemberRole[] = ["admin", "operations", "user"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if user is already a member (check by email)
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      const existingMembership = await storage.getMembership(existingUser.id, ctx.organizationId);
      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 400 }
        );
      }
    }

    // Check if invite already exists for this email
    const existingInvites = await storage.getInvitesByOrg(ctx.organizationId);
    const existingInvite = existingInvites.find(i => i.email.toLowerCase() === email.toLowerCase());
    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite already exists for this email" },
        { status: 400 }
      );
    }

    // Check team member quota
    const org = await storage.getOrganization(ctx.organizationId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const quotaCheck = await canInviteMember(ctx.organizationId, org.plan);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { 
          error: quotaCheck.reason || "Team member limit reached",
          quotaExceeded: true,
          currentUsage: quotaCheck.currentUsage,
          limit: quotaCheck.limit,
        },
        { status: 403 }
      );
    }

    // Generate invite token
    const token = `${ctx.organizationId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const invite = await storage.createInvite({
      organizationId: ctx.organizationId,
      email,
      role,
      invitedBy: ctx.userId,
      token,
      expiresAt,
    });

    // Get inviter info for email
    const inviter = await storage.getUser(ctx.userId);
    const inviterName = inviter?.username || "A team member";

    // Send invite email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const inviteUrl = `${baseUrl}/invite/${token}`;
    const emailHtml = generateInviteEmailHtml(inviteUrl, org.name, role, inviterName);
    
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${org.name} on Sewer Swarm AI`,
      html: emailHtml,
      text: `You've been invited to join ${org.name} on Sewer Swarm AI. Click here to accept: ${inviteUrl}`,
    });

    return NextResponse.json(invite);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error creating invite:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to create invite" },
      { status: 500 }
    );
  }
}


