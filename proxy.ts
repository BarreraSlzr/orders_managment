/**
 * Next.js Edge Middleware – protects routes that require authentication.
 *
 * Public routes (no session required):
 *   - /api/auth/*   (login / callback endpoints)
 *   - /_next/*       (Next.js internals)
 *   - /favicon.ico
 *
 * Everything else requires a valid session cookie.
 * When AUTH_SECRET is not set (local dev without auth), requests pass through.
 */
import { getAdminConfig, hasAdminApiKey } from "@/lib/auth/admin";
import { verifySessionToken } from "@/lib/auth/session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Paths that never require authentication */
const PUBLIC_PATHS = [
  "/api/auth",
  "/api/admin/verify",
  "/api/trpc",
  "/api/sse",
  "/_next",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    try {
      const config = getAdminConfig();
      const hasApiKey = hasAdminApiKey({
        authorizationHeader: request.headers.get("authorization"),
        cookieValue: request.cookies.get(config.cookieName)?.value,
        apiKey: config.apiKey,
      });

      if (!hasApiKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // When AUTH_SECRET is not configured, skip auth (dev convenience)
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.next();
  }

  const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return unauthorizedResponse(request);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return unauthorizedResponse(request);
  }

  // Attach session subject to request headers for downstream use
  const response = NextResponse.next();
  response.headers.set("x-session-sub", session.sub);
  return response;
}

function unauthorizedResponse(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // API routes get a 401 JSON response
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Page routes redirect to the auth endpoint
  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images.
     * Next.js docs recommend this pattern for middleware:
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
