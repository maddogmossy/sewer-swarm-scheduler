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

    const crew = await storage.updateCrew(id, body);
    if (!crew) {
      return NextResponse.json(
        { error: "Crew not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(crew);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to update crew" },
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
    await storage.archiveCrew(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to archive crew" },
      { status: 400 }
    );
  }
}


