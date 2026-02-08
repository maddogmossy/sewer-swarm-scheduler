import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "@/lib/storage";
import { getRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        error: "No userId cookie found",
      });
    }

    // Try to get context
    try {
      const ctx = await getRequestContext();
      return NextResponse.json({
        authenticated: true,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        role: ctx.role,
        plan: ctx.plan,
      });
    } catch (error: any) {
      // Check if user exists
      let user;
      try {
        user = await storage.getUser(userId);
      } catch (e) {
        // User doesn't exist
      }

      // Check memberships
      let memberships;
      try {
        memberships = await storage.getMembershipsByUser(userId);
      } catch (e) {
        memberships = [];
      }

      return NextResponse.json({
        authenticated: false,
        userId,
        userExists: !!user,
        membershipsCount: memberships.length,
        error: error.message || "Failed to get context",
        memberships: memberships.map(m => ({
          id: m.id,
          organizationId: m.organizationId,
          role: m.role,
        })),
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

