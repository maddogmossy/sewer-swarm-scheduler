import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json(
        { status: "degraded", database: "not configured" },
        { status: 503 }
      );
    }

    // ✅ Drizzle-safe test query
    await db.execute(sql`select 1`);

    // Try to query users table to ensure it exists and is accessible
    try {
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      console.log("Health check: Database connected, users table accessible");
      
      return NextResponse.json({
        status: "ok",
        database: "connected",
        usersTable: "accessible",
        userCount: userCount.rows[0]?.count || 0,
      });
    } catch (tableError: any) {
      console.error("Health check: Database connected but users table error:", {
        error: tableError.message,
        code: tableError.code,
      });
      
      return NextResponse.json({
        status: "degraded",
        database: "connected",
        usersTable: "error",
        error: tableError.message,
      }, { status: 503 });
    }
  } catch (error: any) {
    console.error("Health check failed:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack?.substring(0, 500),
    });

    return NextResponse.json(
      {
        status: "error",
        message: error?.message ?? "Unknown error",
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
