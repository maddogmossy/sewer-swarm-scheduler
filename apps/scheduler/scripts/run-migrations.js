#!/usr/bin/env node

/**
 * Standalone database migration script (same logic as /api/run-migrations).
 * Run after git pull to keep the dev DB in sync. Uses DATABASE_URL from .env.local.
 *
 * Usage: node scripts/run-migrations.js
 * From repo root: node apps/scheduler/scripts/run-migrations.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        const cleanValue = value.replace(/^["']|["']$/g, '');
        if (key && cleanValue) {
          process.env[key.trim()] = cleanValue;
        }
      }
    });
  }
}

loadEnvFile();

function getDatabaseUrl() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.PRODUCTION_DATABASE_URL) {
    return process.env.PRODUCTION_DATABASE_URL;
  }
  return process.env.DATABASE_URL || null;
}

async function runMigration() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or PRODUCTION_DATABASE_URL in production) is not set.');
    console.error('Set it in apps/scheduler/.env.local or in the environment.');
    process.exit(1);
  }

  const isNeon = databaseUrl.includes('neon.tech');
  const isAwsRds = databaseUrl.includes('.rds.amazonaws.com');
  const isLocalhost =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const isProduction = process.env.NODE_ENV === 'production';

  const poolConfig = {
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15000,
  };
  if (isAwsRds || isNeon || (isProduction && !isLocalhost)) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);
  let client;

  try {
    client = await pool.connect();

    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      ) AS exists
    `);
    const tablesExist = checkResult.rows[0]?.exists === true;

    if (tablesExist) {
      await client.query('BEGIN');

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depots' AND column_name = 'archived_at') THEN
            ALTER TABLE "depots" ADD COLUMN "archived_at" timestamp;
          END IF;
        END $$;
      `);

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

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_items' AND column_name = 'job_status') THEN
            ALTER TABLE "schedule_items" ADD COLUMN "job_status" text NOT NULL DEFAULT 'booked';
          END IF;
        END $$;
      `);

      await client.query('COMMIT');
      console.log('Database schema updated (missing columns added).');
      return;
    }

    await client.query('BEGIN');

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
    console.log('Database migration completed successfully (tables created).');
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
