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

    console.log(`[PATCH /api/employees/${id}] Updating employee:`, body);
    const employee = await storage.updateEmployee(id, body);
    console.log(`[PATCH /api/employees/${id}] Updated employee:`, employee);
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to update employee" },
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
    await storage.deleteEmployee(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to delete employee" },
      { status: 400 }
    );
  }
}

