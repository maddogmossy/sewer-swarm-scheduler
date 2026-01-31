import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const item = await storage.updateScheduleItem(params.id, body);
    if (!item) {
      return NextResponse.json(
        { error: "Schedule item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to update schedule item" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    await storage.deleteScheduleItem(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to delete schedule item" },
      { status: 400 }
    );
  }
}

