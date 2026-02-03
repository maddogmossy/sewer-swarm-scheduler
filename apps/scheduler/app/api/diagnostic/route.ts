import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Diagnostic endpoint to check database connectivity and user existence
 * Usage: GET /api/diagnostic?username=mike.moss@sewerswarm.ai
 *        GET /api/diagnostic?email=mike.moss@sewerswarm.ai
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const email = searchParams.get("email");
    
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      database: {
        configured: !!db,
      },
    };

    // Test basic database connection
    if (db) {
      try {
        await db.execute(sql`SELECT 1`);
        diagnostics.database.connected = true;
      } catch (dbError: any) {
        diagnostics.database.connected = false;
        diagnostics.database.error = {
          message: dbError.message,
          code: dbError.code,
        };
        return NextResponse.json(diagnostics, { status: 503 });
      }
    } else {
      diagnostics.database.connected = false;
      diagnostics.database.error = "Database not configured";
      return NextResponse.json(diagnostics, { status: 503 });
    }

    // Check if user exists by username
    if (username) {
      try {
        const user = await storage.getUserByUsername(username);
        diagnostics.user = {
          username,
          exists: !!user,
          foundBy: "username",
          userId: user?.id,
          email: user?.email,
        };
      } catch (error: any) {
        diagnostics.user = {
          username,
          exists: false,
          error: error.message,
        };
      }
    }

    // Check if user exists by email
    if (email) {
      try {
        const user = await storage.getUserByEmail(email);
        diagnostics.user = {
          email,
          exists: !!user,
          foundBy: "email",
          userId: user?.id,
          username: user?.username,
        };
      } catch (error: any) {
        diagnostics.user = {
          email,
          exists: false,
          error: error.message,
        };
      }
    }

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error("Diagnostic endpoint error:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.substring(0, 500),
    });

    return NextResponse.json(
      {
        error: error?.message ?? "Unknown error",
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
