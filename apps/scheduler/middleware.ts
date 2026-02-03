import { NextRequest, NextResponse } from "next/server";

/**
 * EDGE-SAFE middleware
 * - Auth only
 * - No database access
 * - No pg / drizzle imports
 */

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Allow public routes
  if (
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/invites") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Example: read auth cookie (adjust later for NextAuth)
  const userId = req.cookies.get("userId")?.value;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated → continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - static files
     * - next internals
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
