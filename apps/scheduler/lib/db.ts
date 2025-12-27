import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false, // REQUIRED for AWS RDS
  },
});

export const db = drizzle(pool, { schema });
