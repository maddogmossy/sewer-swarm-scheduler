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
  company: z.string().optional(),
  plan: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, email, role, company, plan } = registerSchema.parse(body);

    // If username looks like an email, treat it as email and use it for both
    const isEmailFormat = username.includes("@");
    const finalEmail = email || (isEmailFormat ? username : undefined);
    const finalUsername = isEmailFormat ? username : username; // Use email as username if it's an email

    // Check if email already exists (prioritize email check)
    if (finalEmail) {
      try {
        const existingByEmail = await storage.getUserByEmail(finalEmail);
        if (existingByEmail) {
          return NextResponse.json(
            { error: "This email address is already registered. Please sign in instead." },
            { status: 400 }
          );
        }
      } catch (dbError: any) {
        // If it's a connection error, return a user-friendly message
        if (dbError.message?.includes("Database connection") || 
            dbError.message?.includes("ENOTFOUND") || 
            dbError.message?.includes("ECONNREFUSED")) {
          return NextResponse.json(
            { error: "Unable to connect to the database. Please try again later." },
            { status: 503 }
          );
        }
        throw dbError; // Re-throw other errors
      }
    }

    // Check if user already exists by username (only if username is not an email)
    if (!isEmailFormat) {
      try {
        const existingByUsername = await storage.getUserByUsername(finalUsername);
        if (existingByUsername) {
          return NextResponse.json(
            { error: "This username is already taken. Please choose another." },
            { status: 400 }
          );
        }
      } catch (dbError: any) {
        // If it's a connection error, return a user-friendly message
        if (dbError.message?.includes("Database connection") || 
            dbError.message?.includes("ENOTFOUND") || 
            dbError.message?.includes("ECONNREFUSED")) {
          return NextResponse.json(
            { error: "Unable to connect to the database. Please try again later." },
            { status: 503 }
          );
        }
        throw dbError; // Re-throw other errors
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - use email as username if username is an email
    const user = await storage.createUser({
      id: randomUUID(),
      username: finalUsername,
      password: hashedPassword,
      email: finalEmail,
      role: role || "user",
    });

    // Create organization for this user
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Use company name if provided, otherwise use a friendly name
    const organizationName = company?.trim() || (finalEmail ? `${finalEmail.split('@')[0]}'s Organization` : `${finalUsername}'s Organization`);
    // Determine plan: "pro" if plan contains "professional" or "pro", otherwise "starter"
    const selectedPlan = plan && (plan.toLowerCase().includes("professional") || plan.toLowerCase().includes("pro")) ? "pro" : "starter";

    const organization = await storage.createOrganization({
      id: randomUUID(),
      name: organizationName,
      ownerId: user.id,
      plan: selectedPlan,
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

    // Create a default depot with day and night crews for new users
    try {
      const defaultDepot = await storage.createDepot({
        id: randomUUID(),
        name: "Main Depot",
        address: "Address to be updated",
        userId: user.id,
        organizationId: organization.id,
      });
      // Note: createDepot now automatically creates day and night crews
      console.log("Default depot and crews created for new user:", defaultDepot.id);
    } catch (depotError) {
      // Log error but don't fail registration
      console.error("Failed to create default depot for new user:", depotError);
    }

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
        { error: "Invalid request data. Please check all fields are filled correctly." },
        { status: 400 }
      );
    }
    
    // Log detailed error for debugging (server-side only)
    console.error("Registration error:", {
      message: error.message,
      code: error.code,
      name: error.name,
      cause: error.cause,
      stack: error.stack?.substring(0, 1000), // First 1000 chars of stack
    });
    
    // Return user-friendly error message (don't expose internal details)
    let errorMessage = "Registration failed. Please try again.";
    let statusCode = 500;
    
    if (error.message?.includes("Database connection") || 
        error.message?.includes("ENOTFOUND") || 
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("Database not configured")) {
      errorMessage = "Unable to connect to the database. Please try again later or contact support.";
      statusCode = 503;
    } else if (error.message?.includes("already registered") || 
        error.message?.includes("already exists") ||
        error.message?.includes("already taken")) {
      errorMessage = error.message; // Use the friendly message we created
      statusCode = 400;
    } else if (error.message && process.env.NODE_ENV === 'development') {
      // In development, show more details
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

