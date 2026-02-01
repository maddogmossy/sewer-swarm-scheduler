import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// GET /api/user - Get current user ID
export async function GET() {
  try {
    const ctx = await getRequestContext();
    return NextResponse.json({ userId: ctx.userId });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message ?? "Failed to get user" },
      { status: 500 }
    );
  }
}

