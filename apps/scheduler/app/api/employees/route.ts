import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getRequestContext } from "@/lib/request-context";
import { requireAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdmin(ctx);

    const employees = await storage.getEmployeesByOrg(ctx.organizationId);
    return NextResponse.json(employees);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: err.message?.includes("Unauthorized") ? 401 : 403 }
    );
  }
}
