import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { storage } from "@/lib/storage";
import { insertUserSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { z } from "zod";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  email: z.string().email().optional(),
  role: z.string().optional().default("user"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email, role } = registerSchema.parse(body);

    // Check if user already exists by username
    const existingByUsername = await storage.getUserByUsername(username);
    if (existingByUsername) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    // Check if email already exists (if email is provided)
    if (email) {
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await storage.createUser({
      id: randomUUID(),
      username,
      password: hashedPassword,
      email,
      role: role || "user",
    });

    // Create organization for this user
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const organization = await storage.createOrganization({
      id: randomUUID(),
      name: `${username}'s Organization`,
      ownerId: user.id,
      plan: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt,
    });

    // Create membership making this user an admin
    await storage.createMembership({
      id: randomUUID(),
      userId: user.id,
      organizationId: organization.id,
      role: "admin",
      acceptedAt: new Date(),
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("userId", user.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      organization: {
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    );
  }
}

