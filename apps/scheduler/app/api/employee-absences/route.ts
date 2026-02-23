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
  } catch (err: any) {
    throw err;
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    await ensureEmployeeAbsencesTable();
    const absences = await storage.getEmployeeAbsencesByOrg(ctx.organizationId);
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

