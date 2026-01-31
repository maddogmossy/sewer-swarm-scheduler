import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const depots = await storage.getDepotsByOrg(ctx.organizationId);
    return NextResponse.json(depots);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: 403 }
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
