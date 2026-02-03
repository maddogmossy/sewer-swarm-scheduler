import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { storage } from "@/lib/storage";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// POST /api/invites/accept - Accept an invite and create/join user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, username } = body;

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

    // Check if user already exists with this email
    let user = await storage.getUserByEmail(invite.email);
    
    if (!user) {
      // New user - need password and username
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: "Password is required and must be at least 6 characters" },
          { status: 400 }
        );
      }

      // Use email as username if username not provided
      const finalUsername = username || invite.email;
      
      // Check if username is already taken
      const existingUsername = await storage.getUserByUsername(finalUsername);
      if (existingUsername) {
        return NextResponse.json(
          { error: "Username is already taken. Please choose a different username." },
          { status: 400 }
        );
      }

      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await storage.createUser({
        id: randomUUID(),
        username: finalUsername,
        password: hashedPassword,
        email: invite.email,
        role: "user", // Default role, will be overridden by membership role
      });
    } else {
      // Existing user - verify password if provided
      if (password) {
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid password" },
            { status: 401 }
          );
        }
      }
    }

    // Check if user is already a member
    const existingMembership = await storage.getMembership(user.id, invite.organizationId);
    if (existingMembership) {
      // Already a member, delete the invite and log them in
      await storage.deleteInvite(invite.id);
      
      const cookieStore = await cookies();
      cookieStore.set("userId", user.id, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return NextResponse.json({
        success: true,
        message: "You are already a member of this organization",
        userId: user.id,
      });
    }

    // Create membership
    await storage.createMembership({
      id: randomUUID(),
      userId: user.id,
      organizationId: invite.organizationId,
      role: invite.role,
      acceptedAt: new Date(),
    });

    // Delete the invite
    await storage.deleteInvite(invite.id);

    // Set authentication cookie
    const cookieStore = await cookies();
    cookieStore.set("userId", user.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      success: true,
      message: "Invite accepted successfully",
      userId: user.id,
    });
  } catch (err: any) {
    console.error("Error accepting invite:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to accept invite" },
      { status: 500 }
    );
  }
}
