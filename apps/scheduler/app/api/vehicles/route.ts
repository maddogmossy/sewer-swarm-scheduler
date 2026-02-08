import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const vehicles = await storage.getVehiclesByOrg(ctx.organizationId);
    return NextResponse.json(vehicles);
  } catch (err: any) {
    console.error("[GET /api/vehicles] Error:", {
      message: err.message,
      errorType: err.constructor?.name,
      stack: err.stack?.substring(0, 500),
    });
    const isUnauthorized = err.message?.includes("Unauthorized");
    const isDatabaseError = err.message?.includes("Database") || err.message?.includes("Failed query") || err.constructor?.name === "DrizzleQueryError";
    
    // Return 500 for database errors, 401 for auth errors, 403 for other errors
    const status = isUnauthorized ? 401 : (isDatabaseError ? 500 : 403);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch vehicles" },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const vehicle = await storage.createVehicle({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to create vehicle" },
      { status: 400 }
    );
  }
}
