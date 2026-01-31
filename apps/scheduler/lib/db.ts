import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

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

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Please set DATABASE_URL for development or PRODUCTION_DATABASE_URL for production.");
}

// Determine if we need SSL (required for AWS RDS and Neon, not needed for localhost)
const isAwsRds = databaseUrl.includes('.rds.amazonaws.com');
const isNeon = databaseUrl.includes('neon.tech');
const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig: any = {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15000,
};

// AWS RDS and Neon require SSL, but localhost should not use SSL
if (isAwsRds || isNeon || (isProduction && !isLocalhost)) {
  poolConfig.ssl = {
    rejectUnauthorized: false, // REQUIRED for AWS RDS and Neon
  };
  if (isNeon) {
    console.log("SSL enabled for database connection (Neon detected)");
  } else if (isAwsRds) {
    console.log("SSL enabled for database connection (AWS RDS detected)");
  } else {
    console.log("SSL enabled for database connection (production detected)");
  }
} else if (isLocalhost) {
  console.log("Using local database connection (SSL disabled)");
}

export const pool = new Pool(poolConfig);

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  
  // Log helpful information for connection errors
  if (err.code === 'ENOTFOUND') {
    console.error(
      `\n❌ Database DNS Error: Cannot resolve hostname "${err.hostname || 'unknown'}".\n` +
      `   This usually means:\n` +
      `   1. The DATABASE_URL environment variable points to a non-existent database\n` +
      `   2. The database server was deleted or moved\n` +
      `   3. There's a network connectivity issue\n` +
      `   Please verify your DATABASE_URL is correct.\n`
    );
  } else if (err.code === 'ECONNREFUSED') {
    console.error(
      `\n❌ Database Connection Refused: The database server is not accepting connections.\n` +
      `   Please verify that the database is running and accessible.\n`
    );
  }
});

// Test connection on startup (non-blocking)
pool.connect()
  .then((client) => {
    console.log('✓ Database connection successful');
    client.release();
  })
  .catch((err) => {
    if (err.code === 'ENOTFOUND') {
      console.error(
        `\n⚠️  Database Connection Warning: Cannot resolve database hostname.\n` +
        `   The application will start, but database operations will fail until this is resolved.\n` +
        `   Error: ${err.message}\n`
      );
    } else {
      console.error('⚠️  Database connection test failed:', err.message);
    }
  });

export const db = drizzle(pool, { schema });
