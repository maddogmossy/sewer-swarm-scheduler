import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAdminOrOperations } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

// Standard default color labels for all users
const STANDARD_COLOR_LABELS: Record<string, string> = {
  sky: "Folder Returned",
  pink: "Sent for Pro Forma",
  gray: "Invoiced",
  orange: "Report Require - Invoice Sent",
  teal: "WIP",
  stone: "Order Required",
};

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

    // If no labels exist for the organization, initialize with standard defaults
    if (Object.keys(labelsRecord).length === 0) {
      // Initialize standard labels for this organization
      for (const [color, label] of Object.entries(STANDARD_COLOR_LABELS)) {
        await storage.upsertColorLabel(ctx.userId, color, label, ctx.organizationId);
        labelsRecord[color] = label;
      }
    } else {
      // Merge with standard defaults to ensure all standard colors are available
      for (const [color, label] of Object.entries(STANDARD_COLOR_LABELS)) {
        if (!labelsRecord[color]) {
          labelsRecord[color] = label;
        }
      }
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



