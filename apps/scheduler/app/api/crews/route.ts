import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * GET /api/crews
 * Returns crews for active organization
 */
export async function GET(request: Request) {
  try {
    const ctx = await getRequestContext();

    // Allow admin + operations
    requireAdminOrOperations(ctx);

    // Check for includeArchived query parameter
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const crews = includeArchived
      ? await storage.getAllCrewsByOrg(ctx.organizationId)
      : await storage.getCrewsByOrg(ctx.organizationId);

    return NextResponse.json(crews);
  } catch (err: any) {
    console.error("CREWS ROUTE ERROR:", err.message);

    return NextResponse.json(
      { error: err.message ?? "Forbidden" },
      { status: err.message?.includes("Unauthorized") ? 401 : 403 }
    );
  }
}
