import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const { id } = await params;
    const body = await req.json();

    console.log(`[PATCH /api/vehicles/${id}] Updating vehicle:`, body);
    const vehicle = await storage.updateVehicle(id, body);
    console.log(`[PATCH /api/vehicles/${id}] Updated vehicle:`, vehicle);
    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(vehicle);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to update vehicle" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const { id } = await params;
    await storage.deleteVehicle(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to delete vehicle" },
      { status: 400 }
    );
  }
}

