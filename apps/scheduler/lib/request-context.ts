import { cookies } from "next/headers";
import { storage } from "@/lib/storage";

export interface OrganizationContext {
  userId: string;
  organizationId: string;
  role: "admin" | "user";
  plan: "starter" | "pro";
}

export async function getRequestContext(): Promise<OrganizationContext> {
  // 1. Read userId from cookie (ASYNC in App Router)
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    throw new Error("Unauthorized: missing userId cookie");
  }

  // 2. Load primary membership
  const membership = await storage.getPrimaryMembership(userId);

  if (!membership) {
    throw new Error("No organization membership found");
  }

  // 3. Normalize role (member → user)
  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role === "member" ? "user" : membership.role,
    plan: membership.organization.plan,
  };
}
