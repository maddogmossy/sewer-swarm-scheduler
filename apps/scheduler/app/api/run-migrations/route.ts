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

    // If tables don't exist, create them all
    if (!tablesExist) {
      // Continue with full migration below
    } else {
      // Tables exist, but we need to check for missing columns and add them
      // This handles incremental schema updates
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Create employee_absences table if missing
        await client.query(`
          CREATE TABLE IF NOT EXISTS "employee_absences" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "organization_id" varchar NOT NULL,
            "employee_id" varchar NOT NULL,
            "absence_type" text NOT NULL,
            "start_date" timestamp NOT NULL,
            "end_date" timestamp NOT NULL,
            "created_by" varchar,
            "created_at" timestamp DEFAULT now(),
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
            FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
            FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
          );
        `);

        // Add archived_at to depots if it doesn't exist
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depots' AND column_name = 'archived_at') THEN
              ALTER TABLE "depots" ADD COLUMN "archived_at" timestamp;
            END IF;
          END $$;
        `);

        // Add category and color columns to vehicles if they don't exist
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'category') THEN
              ALTER TABLE "vehicles" ADD COLUMN "category" text;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'color') THEN
              ALTER TABLE "vehicles" ADD COLUMN "color" text;
            END IF;
          END $$;
        `);

        // Add home_postcode and starts_from_home columns to employees if they don't exist
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

        // Add job_status column to schedule_items if it doesn't exist
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_items' AND column_name = 'job_status') THEN
              ALTER TABLE "schedule_items" ADD COLUMN "job_status" text NOT NULL DEFAULT 'booked';
            END IF;
          END $$;
        `);

        await client.query("COMMIT");
        client.release();

        return NextResponse.json({
          message: "Database schema updated successfully (missing columns added)",
          migrated: true,
        });
      } catch (error: any) {
        await client.query("ROLLBACK");
        client.release();
        throw error;
      }
    }

    // Delegate to the existing /api/migrate logic via direct SQL (duplicated here to avoid import issues)
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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
          "archived_at" timestamp,
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
          "home_postcode" text,
          "starts_from_home" boolean DEFAULT false NOT NULL,
          "depot_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Create employee_absences table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "employee_absences" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" varchar NOT NULL,
          "employee_id" varchar NOT NULL,
          "absence_type" text NOT NULL,
          "start_date" timestamp NOT NULL,
          "end_date" timestamp NOT NULL,
          "created_by" varchar,
          "created_at" timestamp DEFAULT now(),
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
        );
      `);

      // Create vehicles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "vehicles" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "name" text NOT NULL,
          "status" text DEFAULT 'active' NOT NULL,
          "vehicle_type" text NOT NULL,
          "category" text,
          "color" text,
          "depot_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "organization_id" varchar,
          FOREIGN KEY ("depot_id") REFERENCES "depots"("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
        );
      `);

      // Add category and color columns to vehicles if they don't exist
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'category') THEN
            ALTER TABLE "vehicles" ADD COLUMN "category" text;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'color') THEN
            ALTER TABLE "vehicles" ADD COLUMN "color" text;
          END IF;
        END $$;
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
          "job_status" text NOT NULL DEFAULT 'booked',
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

      // Add job_status column to schedule_items if it doesn't exist
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_items' AND column_name = 'job_status') THEN
            ALTER TABLE "schedule_items" ADD COLUMN "job_status" text NOT NULL DEFAULT 'booked';
          END IF;
        END $$;
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

      await client.query("COMMIT");

      return NextResponse.json({
        message: "Database migration completed successfully",
        migrated: true,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Run-migrations error:", error);
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return await runMigration();
}

export async function GET() {
  return await runMigration();
}

