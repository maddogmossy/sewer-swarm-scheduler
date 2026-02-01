import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getRequestContext();
    requireAdminOrOperations(ctx);

    const labels = await storage.getColorLabelsByOrg(ctx.organizationId);
    
    // Convert array to record
    const labelsRecord: Record<string, string> = {};
    for (const label of labels) {
      labelsRecord[label.color] = label.label;
    }

    return NextResponse.json(labelsRecord);
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
    const { color, label } = body;

    if (!color || !label) {
      return NextResponse.json(
        { error: "Color and label are required" },
        { status: 400 }
      );
    }

    await storage.upsertColorLabel(ctx.userId, color, label, ctx.organizationId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to save color label" },
      { status: 400 }
    );
  }
}



