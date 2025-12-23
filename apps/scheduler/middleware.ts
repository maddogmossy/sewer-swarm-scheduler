import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadOrganizationContext } from "./lib/rbac";
import { storage } from "./lib/storage";

/**
 * Gets the userId from the request.
 * This assumes userId is stored in a cookie named 'userId' or in a session.
 * Adjust this based on your actual authentication implementation.
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  // Try to get userId from cookie
  const userId = request.cookies.get("userId")?.value;
  if (userId) {
    return userId;
  }

  // If using session-based auth, you may need to decode a session token
  // Example: const session = await getSession(request);
  // return session?.userId ?? null;

  return null;
}

/**
 * Next.js middleware for RBAC.
 * This middleware ensures authentication and loads organization context.
 * 
 * Usage in route handlers:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const userId = getUserIdFromRequest(request);
 *   if (!userId) {
 *     return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
 *   }
 *   
 *   const orgContext = await loadOrganizationContext(userId, storage);
 *   // Use orgContext for authorization checks
 * }
 * ```
 * 
 * Or use this middleware in next.config.ts matcher to protect routes:
 * ```ts
 * export const config = {
 *   matcher: '/api/:path*',
 * };
 * ```
 */
export async function middleware(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const orgContext = await loadOrganizationContext(userId, storage);
    
    // Attach org context to request headers for use in route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-org-id", orgContext.organizationId);
    requestHeaders.set("x-membership-id", orgContext.membershipId);
    requestHeaders.set("x-role", orgContext.role);
    requestHeaders.set("x-plan", orgContext.plan);
    requestHeaders.set("x-subscription-status", orgContext.subscriptionStatus);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("Error loading organization context:", error);
    
    if (error instanceof Error && error.message === "No organization membership found") {
      return NextResponse.json(
        { error: "No organization membership found" },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to load organization context" },
      { status: 500 }
    );
  }
}

/**
 * Configure which routes this middleware should run on.
 * Adjust the matcher pattern based on your needs.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

