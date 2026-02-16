/**
 * GET /api/auth/login
 *
 * Stub login endpoint.  In the current MVP this accepts a `sub` query
 * parameter and issues a session cookie.  In a production deployment
 * this would redirect to an external IdP / OAuth flow.
 *
 * Query params:
 *   - sub       (required)  subject / user identifier
 *   - redirect  (optional)  where to send the user after login (default "/")
 */
import { setSessionCookie } from "@/lib/auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sub = request.nextUrl.searchParams.get("sub");
  const redirect = request.nextUrl.searchParams.get("redirect") || "/";

  if (!sub) {
    return NextResponse.json(
      { error: "Missing required query parameter: sub" },
      { status: 400 }
    );
  }

  const redirectUrl = new URL(redirect, request.url);
  const response = NextResponse.redirect(redirectUrl);

  await setSessionCookie(response, sub);

  return response;
}
