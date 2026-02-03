import { NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

async function runMigration() {
  try {
    if (!db || !pool) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
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

    if (tablesExist) {
      return NextResponse.json({
        message: "Database tables already exist",
        migrated: false,
      });
    }

    // Run migration SQL
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create organizations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "organizations" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "owner_id" varchar NOT NULL,
          "plan" text NOT NULL DEFAULT 'starter',
          "stripe_customer_id" text,
          "stripe_subscription_id" text,
          "subscription_status" text DEFAULT 'trialing',
          "trial_ends_at" timestamp,
          "created_at" timestamp DEFAULT now()
        );
      `);

      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "username" text NOT NULL UNIQUE,
          "password" text NOT NULL,
          "email" text,
          "role" text NOT NULL DEFAULT 'user',
          "created_at" timestamp DEFAULT now(),
          "stripe_customer_id" text,
          "stripe_subscription_id" text,
          "subscription_status" text,
          "trial_ends_at" timestamp
        );
      `);

      // Create organization_memberships table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "organization_memberships" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "role" text NOT NULL DEFAULT 'user',
          "invited_by" varchar,
          "invited_at" timestamp DEFAULT now(),
          "accepted_at" timestamp,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
        );
      `);

      // Create team_invites table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "team_invites" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" varchar NOT NULL,
          "email" text NOT NULL,
          "role" text NOT NULL DEFAULT 'user',
          "invited_by" varchar NOT NULL,
          "token" text NOT NULL UNIQUE,
          "expires_at" timestamp NOT NULL,
          "created_at" timestamp DEFAULT now(),
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create depots table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "depots" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "address" text NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create crews table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "crews" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "depot_id" varchar NOT NULL,
          "shift" text DEFAULT 'day' NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          "archived_at" timestamp,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create employees table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "employees" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "status" text DEFAULT 'active' NOT NULL,
          "job_role" text DEFAULT 'operative' NOT NULL,
          "email" text,
          "depot_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create vehicles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "vehicles" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "status" text DEFAULT 'active' NOT NULL,
          "vehicle_type" text NOT NULL,
          "depot_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create schedule_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "schedule_items" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "type" text NOT NULL,
          "date" timestamp NOT NULL,
          "crew_id" varchar NOT NULL,
          "depot_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          "status" text NOT NULL DEFAULT 'approved',
          "requested_by" varchar,
          "approved_by" varchar,
          "approved_at" timestamp,
          "rejection_reason" text,
          "customer" text,
          "job_number" text,
          "address" text,
          "project_manager" text,
          "start_time" text,
          "onsite_time" text,
          "color" text,
          "duration" integer,
          "employee_id" varchar,
          "vehicle_id" varchar,
          "note_content" text,
          FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
          FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE
        );
      `);

      // Create color_labels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "color_labels" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "color" text NOT NULL,
          "label" text NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      await client.query('COMMIT');

      return NextResponse.json({
        message: "Database migration completed successfully",
        migrated: true,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}

// Allow both POST (for programmatic use) and GET (for simple browser triggering)
export async function POST() {
  return runMigration();
}

export async function GET() {
  return runMigration();
}
