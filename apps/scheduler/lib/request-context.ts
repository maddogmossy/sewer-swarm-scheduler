import { cookies } from "next/headers";
import { storage } from "@/lib/storage";

export interface OrganizationContext {
  userId: string;
  organizationId: string;
  role: "admin" | "operations" | "user";
  plan: "starter" | "pro";
}

export async function getRequestContext(): Promise<OrganizationContext> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    console.error("[getRequestContext] No userId cookie found");
    throw new Error("Unauthorized: No user session found");
  }

  try {
    const membership = await storage.getPrimaryMembership(userId);

    if (!membership) {
      console.error("[getRequestContext] No membership found for userId:", userId);
      // Check if user exists but has no memberships
      const memberships = await storage.getMembershipsByUser(userId);
      console.error("[getRequestContext] User has", memberships.length, "memberships");
      throw new Error("Unauthorized: No organization membership found");
    }

    // Normalize role (member → user)
    const normalizedRole = membership.role === "member" ? "user" : membership.role;

    return {
      userId,
      organizationId: membership.organizationId,
      role: normalizedRole as "admin" | "operations" | "user",
      plan: membership.organization.plan,
    };
  } catch (error: any) {
    // If it's already an Error with a message, re-throw it
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      throw error;
    }
    // Otherwise, log and wrap it
    console.error("[getRequestContext] Error getting membership:", {
      userId,
      error: error?.message || String(error),
      stack: error?.stack?.substring(0, 500),
    });
    throw new Error(`Unauthorized: ${error?.message || "Failed to load user context"}`);
  }
}