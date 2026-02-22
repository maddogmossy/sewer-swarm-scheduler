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

    const depot = await storage.updateDepot(id, body);
    if (!depot) {
      return NextResponse.json(
        { error: "Depot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(depot);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to update depot" },
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
    const depot = await storage.archiveDepot(id);
    if (!depot) {
      return NextResponse.json(
        { error: "Depot not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(depot);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to archive depot" },
      { status: 400 }
    );
  }
}


