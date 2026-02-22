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
    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H2',location:'apps/scheduler/lib/request-context.ts:no-user-cookie',message:'Missing userId cookie in request context',data:{hasUserIdCookie:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

    // #region agent log
    fetch('http://127.0.0.1:7833/ingest/14e31b90-ddbd-4f4c-a0e9-ce008196ce47',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d4c22d'},body:JSON.stringify({sessionId:'d4c22d',runId:'pre-fix',hypothesisId:'H1,H2',location:'apps/scheduler/lib/request-context.ts:membership',message:'Resolved request context',data:{userIdPrefix:String(userId).slice(0,6),organizationIdPrefix:String(membership.organizationId).slice(0,6),role:normalizedRole,plan:membership.organization?.plan},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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