import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { storage } from "@/lib/storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    // Try to find user by username or email
    // Check if input looks like an email (contains @)
    const isEmail = username.includes("@");
    
    let user;
    try {
      user = isEmail
        ? await storage.getUserByEmail(username)
        : await storage.getUserByUsername(username);
    } catch (dbError: any) {
      console.error("Database error during login:", {
        error: dbError.message,
        code: dbError.code,
        username: username.substring(0, 5) + "***", // Log partial username for privacy
        isEmail,
      });
      
      // Check if it's a database connection error
      if (dbError.message?.includes("Database not configured") || 
          dbError.code === "ENOTFOUND" || 
          dbError.code === "ECONNREFUSED") {
        return NextResponse.json(
          { error: "Database connection error. Please try again later." },
          { status: 503 }
        );
      }
      
      throw dbError; // Re-throw other errors
    }
    
    if (!user) {
      console.log("Login attempt failed: User not found", { 
        username: username.substring(0, 5) + "***",
        isEmail 
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log("Login attempt failed: Invalid password", { 
        userId: user.id,
        username: username.substring(0, 5) + "***"
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
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
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("Login validation error:", error.errors);
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }
    
    // Log detailed error information for debugging
    console.error("Login error:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.substring(0, 500), // First 500 chars of stack
    });
    
    // Provide more specific error messages
    let errorMessage = "Login failed";
    if (error.message?.includes("Database not configured")) {
      errorMessage = "Database connection error. Please contact support.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

