import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function ensureEmployeeAbsencesTable() {
  const client = await pool.connect();
  try {
    const existsRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'employee_absences'
      ) AS "exists";
    `);
    const exists = existsRes.rows?.[0]?.exists === true;

    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H3',location:'apps/scheduler/app/api/employee-absences/route.ts:ensureEmployeeAbsencesTable:exists',message:'ensureEmployeeAbsencesTable checked',data:{exists},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (exists) return;

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

    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H3',location:'apps/scheduler/app/api/employee-absences/route.ts:ensureEmployeeAbsencesTable:created',message:'ensureEmployeeAbsencesTable created table',data:{created:true},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H3',location:'apps/scheduler/app/api/employee-absences/route.ts:ensureEmployeeAbsencesTable:error',message:'ensureEmployeeAbsencesTable failed',data:{errorType:err?.constructor?.name,code:err?.code,msg:typeof err?.message==='string'?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const ctx = await getRequestContext();
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1,H2,H3',location:'apps/scheduler/app/api/employee-absences/route.ts:GET:ctx',message:'GET /api/employee-absences ctx resolved',data:{hasUserId:!!ctx?.userId,hasOrgId:!!ctx?.organizationId,role:(ctx as any)?.role,plan:(ctx as any)?.plan},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    requireAdminOrOperations(ctx);
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1',location:'apps/scheduler/app/api/employee-absences/route.ts:GET:rbac-ok',message:'GET /api/employee-absences RBAC passed',data:{role:(ctx as any)?.role},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    await ensureEmployeeAbsencesTable();
    const absences = await storage.getEmployeeAbsencesByOrg(ctx.organizationId);
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H3',location:'apps/scheduler/app/api/employee-absences/route.ts:GET:ok',message:'GET /api/employee-absences storage ok',data:{count:Array.isArray(absences)?absences.length:null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json(absences);
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    const isUnauthorized = msg.includes("Unauthorized");
    const isLikelyDbError =
      msg.toLowerCase().includes("database") ||
      msg.toLowerCase().includes("relation") ||
      msg.toLowerCase().includes("schema") ||
      msg.toLowerCase().includes("migration");
    const status = isUnauthorized ? 401 : isLikelyDbError ? 500 : 403;
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1,H2,H3',location:'apps/scheduler/app/api/employee-absences/route.ts:GET:catch',message:'GET /api/employee-absences failed',data:{status,msg,errorType:err?.constructor?.name},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: msg || "Forbidden" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    await ensureEmployeeAbsencesTable();
    const body = await req.json();
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
    const absenceType = typeof body?.absenceType === "string" ? body.absenceType : "";
    const startDateRaw = body?.startDate;
    const endDateRaw = body?.endDate;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }
    if (absenceType !== "holiday" && absenceType !== "sick") {
      return NextResponse.json(
        { error: 'absenceType must be "holiday" or "sick"' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw ?? startDateRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "startDate/endDate must be valid dates" },
        { status: 400 }
      );
    }

    const created = await storage.createEmployeeAbsence({
      organizationId: ctx.organizationId,
      employeeId,
      absenceType,
      startDate,
      endDate,
      createdBy: ctx.userId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    const isUnauthorized = msg.includes("Unauthorized");
    const isLikelyDbError =
      msg.toLowerCase().includes("database") ||
      msg.toLowerCase().includes("relation") ||
      msg.toLowerCase().includes("schema") ||
      msg.toLowerCase().includes("migration");
    const status = isUnauthorized ? 401 : isLikelyDbError ? 500 : 400;
    return NextResponse.json({ error: msg || "Failed" }, { status });
  }
}

