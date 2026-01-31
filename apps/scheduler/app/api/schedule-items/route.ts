import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const items = await storage.getScheduleItemsByOrg(ctx.organizationId);
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unauthorized" },
      { status: err.message?.includes("Unauthorized") ? 401 : 403 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const body = await req.json();

    const item = await storage.createScheduleItem({
      ...body,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      status: body.status || "approved",
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to create schedule item" },
      { status: 400 }
    );
  }
}

