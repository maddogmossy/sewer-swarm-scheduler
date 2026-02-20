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
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  try {
    const ctx = await getRequestContext();

    console.log("[GET /api/crews] request", {
      includeArchived,
      role: ctx.role,
      organizationId: ctx.organizationId,
    });

    // Allow admin + operations
    requireAdminOrOperations(ctx);

    const crews = includeArchived
      ? await storage.getAllCrewsByOrg(ctx.organizationId)
      : await storage.getCrewsByOrg(ctx.organizationId);

    console.log("[GET /api/crews] ok", { includeArchived, count: Array.isArray(crews) ? crews.length : null });
    return NextResponse.json(crews);
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    const status = msg.includes("Unauthorized") ? 401 : 403;
    console.error("[GET /api/crews] error", {
      includeArchived,
      message: msg,
      status,
      name: err?.name || null,
      stack: typeof err?.stack === "string" ? err.stack.substring(0, 400) : null,
    });

    return NextResponse.json(
      { error: msg || "Forbidden" },
      { status }
    );
  }
}

/**
 * POST /api/crews
 * Creates a new crew for the active organization
 */
export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const crew = await storage.createCrew({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    return NextResponse.json(crew, { status: 201 });
  } catch (err: any) {
    // Ensure error message is always a string
    let errorMsg = "Failed to create crew";
    if (err && typeof err.message === 'string') {
      errorMsg = err.message;
    } else if (err && typeof err === 'string') {
      errorMsg = err;
    } else if (err) {
      errorMsg = String(err);
    }
    
    console.error('[POST /api/crews] Error:', {
      message: errorMsg,
      errorType: err?.constructor?.name,
      body: body,
    });
    
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}
