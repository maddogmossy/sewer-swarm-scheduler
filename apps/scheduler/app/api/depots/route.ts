import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";
import { appendFile } from "node:fs/promises";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const WORKSPACE_DEBUG_LOG_PATH = "c:\\Users\\mike.moss\\Downloads\\Scheduler\\debug-d4c22d.log";

async function appendAgentDebugLog(payload: any) {
  try {
    const line = `${JSON.stringify(payload)}\n`;
    // Prefer absolute workspace path for reliability.
    await appendFile(WORKSPACE_DEBUG_LOG_PATH, line, "utf8");
  } catch {
    try {
      // Fallback: try relative path (in case absolute differs in other environments).
      await appendFile("debug-d4c22d.log", `${JSON.stringify(payload)}\n`, "utf8");
    } catch {
      // Never let debug logging break the route.
    }
  }
}

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

    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1,H2,H3',location:'apps/scheduler/app/api/depots/route.ts:GET:entry',message:'GET /api/depots called',data:{archived,role:ctx.role,organizationIdPrefix:String(ctx.organizationId).slice(0,6)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H1,H2,H3",location:"apps/scheduler/app/api/depots/route.ts:GET:entry",message:"GET /api/depots called",data:{archived,role:ctx.role,organizationIdPrefix:String(ctx.organizationId).slice(0,6)},timestamp:Date.now()});

    requireAdminOrOperations(ctx);
    await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H1",location:"apps/scheduler/app/api/depots/route.ts:GET:after-rbac",message:"RBAC check passed",data:{role:ctx.role},timestamp:Date.now()});

    // Ensure schema is up to date for depots before querying.
    try {
      await ensureDepotColumns();
    } catch (migrationError: any) {
      const migMsg =
        typeof migrationError?.message === "string"
          ? migrationError.message
          : String(migrationError);
      console.error("[GET /api/depots] migration check failed:", migMsg);
      await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H3",location:"apps/scheduler/app/api/depots/route.ts:GET:migration-failed",message:"ensureDepotColumns failed",data:{message:migMsg},timestamp:Date.now()});
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
    await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H3",location:"apps/scheduler/app/api/depots/route.ts:GET:after-query",message:"Depots query ok",data:{archived,count:Array.isArray(depots)?depots.length:null},timestamp:Date.now()});
    return NextResponse.json(depots);
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1,H2,H3',location:'apps/scheduler/app/api/depots/route.ts:GET:catch',message:'GET /api/depots failed',data:{errorMessage:err?.message??String(err),errorName:err?.name,stack:(err?.stack?String(err.stack).slice(0,300):undefined)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

    await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H1,H2,H3",location:"apps/scheduler/app/api/depots/route.ts:GET:catch",message:"GET /api/depots failed",data:{errorMessage:msg,errorName:err?.name,stack:(err?.stack?String(err.stack).slice(0,400):undefined)},timestamp:Date.now()});
    await appendAgentDebugLog({sessionId:"d4c22d",runId:"pre-fix",hypothesisId:"H3",location:"apps/scheduler/app/api/depots/route.ts:GET:catch:cause",message:"Depots query error cause (if any)",data:{cause:causeSummary||null},timestamp:Date.now()});

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
