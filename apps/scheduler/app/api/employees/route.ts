import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

// Helper to check and add missing columns
async function ensureEmployeeColumns() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Check and add missing columns
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'home_postcode') THEN
          ALTER TABLE "employees" ADD COLUMN "home_postcode" text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'starts_from_home') THEN
          ALTER TABLE "employees" ADD COLUMN "starts_from_home" boolean NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);
    
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    // Ensure columns exist before querying
    try {
      await ensureEmployeeColumns();
    } catch (migrationError: any) {
      // Log but don't fail - columns might already exist
      console.log("Migration check:", migrationError.message);
    }

    const employees = await storage.getEmployeesByOrg(ctx.organizationId);
    return NextResponse.json(employees);
  } catch (err: any) {
    // Check if it's a database schema error
    if (err.message?.includes("home_postcode") || err.message?.includes("starts_from_home")) {
      return NextResponse.json(
        { 
          error: "Database schema needs migration. Please visit /api/run-migrations to update the database.",
          details: err.message 
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: 403 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const employee = await storage.createEmployee({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to create employee" },
      { status: 400 }
    );
  }
}
