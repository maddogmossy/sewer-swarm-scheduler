import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

// Helper to ensure required depots columns exist (handles older DBs).
async function ensureDepotColumns() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'depots' AND column_name = 'archived_at') THEN
          ALTER TABLE "depots" ADD COLUMN "archived_at" timestamp;
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

export async function GET(req: Request) {
  try {
    const ctx = await getRequestContext();
    const { searchParams } = new URL(req.url);
    const archived = searchParams.get("archived") === "true";

    requireAdminOrOperations(ctx);

    // Ensure schema is up to date for depots before querying.
    try {
      await ensureDepotColumns();
    } catch (migrationError: any) {
      const migMsg =
        typeof migrationError?.message === "string"
          ? migrationError.message
          : String(migrationError);
      console.error("[GET /api/depots] migration check failed:", migMsg);
      return NextResponse.json(
        {
          error:
            "Database schema needs migration. Please visit /api/run-migrations to update the database.",
          details: migMsg,
        },
        { status: 500 }
      );
    }

    const depots = archived
      ? await storage.getArchivedDepotsByOrg(ctx.organizationId)
      : await storage.getDepotsByOrg(ctx.organizationId);
    return NextResponse.json(depots);
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    const cause: any = (err as any)?.cause;
    const causeSummary =
      cause && typeof cause === "object"
        ? {
            code: typeof cause.code === "string" ? cause.code : undefined,
            message: typeof cause.message === "string" ? cause.message : undefined,
            detail: typeof cause.detail === "string" ? cause.detail : undefined,
            hint: typeof cause.hint === "string" ? cause.hint : undefined,
            where: typeof cause.where === "string" ? cause.where : undefined,
            schema: typeof cause.schema === "string" ? cause.schema : undefined,
            table: typeof cause.table === "string" ? cause.table : undefined,
            column: typeof cause.column === "string" ? cause.column : undefined,
            constraint: typeof cause.constraint === "string" ? cause.constraint : undefined,
            routine: typeof cause.routine === "string" ? cause.routine : undefined,
          }
        : undefined;
    console.error("[GET /api/depots] error", {
      message: msg,
      name: err?.name || null,
      cause: causeSummary || (cause ? String(cause) : null),
      stack: typeof err?.stack === "string" ? err.stack.substring(0, 400) : null,
    });

    const isUnauthorized = msg.includes("Unauthorized");
    const isDbSchemaError =
      causeSummary?.code === "42703" ||
      msg.includes("does not exist") ||
      msg.includes("Failed query:");
    const status = isUnauthorized ? 401 : isDbSchemaError ? 500 : 403;
    return NextResponse.json(
      { error: msg || "Forbidden" },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const depot = await storage.createDepot({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    return NextResponse.json(depot, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to create depot" },
      { status: 400 }
    );
  }
}
