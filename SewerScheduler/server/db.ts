import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "@shared/schema";

// Track database readiness state using an object for live binding
export const dbState = { ready: false };

// For backwards compatibility, also expose a getter function
export function isDbReady(): boolean {
  return dbState.ready;
}

// Get database URL from environment variable (works for both development and production)
function getDatabaseUrl(): string | null {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, prefer PRODUCTION_DATABASE_URL (for AWS RDS)
  if (isProduction && process.env.PRODUCTION_DATABASE_URL) {
    console.log("Using PRODUCTION_DATABASE_URL for production environment (AWS RDS)");
    return process.env.PRODUCTION_DATABASE_URL;
  }
  
  // Fall back to DATABASE_URL for development or if PRODUCTION_DATABASE_URL is not set
  if (process.env.DATABASE_URL) {
    const env = process.env.NODE_ENV || 'development';
    console.log(`Using DATABASE_URL from environment variable (${env} mode)`);
    return process.env.DATABASE_URL;
  }
  
  console.error("DATABASE_URL not found in environment variables.");
  console.error("Please ensure a PostgreSQL database is provisioned.");
  return null;
}

const databaseUrl = getDatabaseUrl();

// Determine if we need SSL (required for AWS RDS)
function getPoolConfig(url: string): pg.PoolConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isAwsRds = url.includes('.rds.amazonaws.com');
  
  const config: pg.PoolConfig = {
    connectionString: url,
    connectionTimeoutMillis: 15000,
  };
  
  // AWS RDS requires SSL
  if (isAwsRds || isProduction) {
    config.ssl = { rejectUnauthorized: false };
    console.log("SSL enabled for database connection");
  }
  
  return config;
}

// Create pool only if we have a database URL
export const pool = databaseUrl ? new pg.Pool(getPoolConfig(databaseUrl)) : null;

// Handle pool errors gracefully
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
    dbState.ready = false;
  });
}

// Export db - will be null if no database URL is configured
export const db = pool ? drizzle(pool, { schema }) : null;

export async function runMigrations(): Promise<boolean> {
  if (!pool || !db) {
    console.error("Database not configured - skipping migrations");
    console.error("Set DATABASE_URL environment variable to enable database features");
    dbState.ready = false;
    return false;
  }
  
  console.log("Checking database connection...");
  
  // Test database connection first
  try {
    const client = await pool.connect();
    console.log("Database connection successful");
    client.release();
  } catch (error: any) {
    console.error("Failed to connect to database:", error.message);
    console.error("Please ensure DATABASE_URL is correctly configured for this environment.");
    dbState.ready = false;
    return false;
  }
  
  console.log("Checking database schema...");
  try {
    // Check if the users table exists (core table that should always exist)
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const tablesExist = result.rows[0]?.exists === true;
    
    if (tablesExist) {
      console.log("Database schema already exists, skipping migrations");
      dbState.ready = true;
      return true;
    }
    
    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations completed successfully");
    dbState.ready = true;
    return true;
  } catch (error: any) {
    console.error("Migration error:", error.message);
    dbState.ready = false;
    return false;
  }
}
