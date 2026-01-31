import { NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Check if DATABASE_URL is set
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({
        connected: false,
        error: "DATABASE_URL environment variable is not set",
        details: "Please set DATABASE_URL in your environment variables or .env file",
      });
    }

    if (!db || !pool) {
      return NextResponse.json({
        connected: false,
        error: "Database connection pool not initialized",
        databaseUrlSet: !!databaseUrl,
      });
    }

    // Test connection
    try {
      await db.execute(sql`select 1`);
    } catch (connError: any) {
      return NextResponse.json({
        connected: false,
        error: "Database connection failed",
        details: connError.message || "Could not connect to database",
        suggestion: "Check your DATABASE_URL and ensure the database server is running and accessible",
      });
    }

    // Check if users table exists
    const checkResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const tablesExist = checkResult.rows[0]?.exists === true;

    // Check all required tables
    const tablesToCheck = [
      'users',
      'organizations',
      'organization_memberships',
      'depots',
      'crews',
      'employees',
      'vehicles',
      'schedule_items',
      'color_labels',
    ];

    const tableStatus: Record<string, boolean> = {};
    for (const table of tablesToCheck) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        );
      `);
      tableStatus[table] = result.rows[0]?.exists === true;
    }

    const allTablesExist = Object.values(tableStatus).every(exists => exists);

    return NextResponse.json({
      connected: true,
      tablesExist: allTablesExist,
      tableStatus,
      message: allTablesExist 
        ? "Database is ready" 
        : "Tables are missing - run /api/migrate to create them",
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      error: error.message || "Database connection failed",
    });
  }
}

