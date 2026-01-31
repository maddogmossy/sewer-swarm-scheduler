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
    throw new Error("Unauthorized");
  }

  const membership = await storage.getPrimaryMembership(userId);

  if (!membership) {
    throw new Error("Unauthorized");
  }

  // Normalize role (member → user)
  const normalizedRole = membership.role === "member" ? "user" : membership.role;
  
  return {
    userId,
    organizationId: membership.organizationId,
    role: normalizedRole as "admin" | "operations" | "user",
    plan: membership.organization.plan,
  };
}