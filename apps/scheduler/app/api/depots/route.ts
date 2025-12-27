import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getRequestContext } from "@/lib/request-context";
import { requireAdmin } from "@/lib/rbac";

export const runtime = "nodejs";


/**
 * GET /api/depots
 * Returns all depots for the user’s active organization
 */
export async function GET() {
  try {
    const ctx = await getRequestContext();

    // RBAC check
    requireAdmin(ctx);

    const depots = await storage.getDepotsByOrg(ctx.organizationId);
    return NextResponse.json(depots);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: err.message?.includes("Unauthorized") ? 401 : 403 }
    );
  }
}


/**
 * POST /api/depots
 * Create a new depot for the active organization
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await storage.getPrimaryMembership(userId);

    if (!membership) {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const depot = await storage.createDepot({
      ...body,
      organizationId: membership.organizationId,
      userId,
    });

    return NextResponse.json(depot, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/depots failed:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
