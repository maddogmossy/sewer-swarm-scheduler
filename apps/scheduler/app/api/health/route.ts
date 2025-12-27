import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

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

    return NextResponse.json({
      status: "ok",
      database: "connected",
    });
  } catch (error: any) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
