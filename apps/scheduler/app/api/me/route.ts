import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get membership to determine role
    const memberships = await storage.getMembershipsByUser(userId);
    const primaryMembership = memberships[0];

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      membershipRole: primaryMembership?.role || "user",
    });
  } catch (error: any) {
    console.error("Get me error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get user" },
      { status: 500 }
    );
  }
}

