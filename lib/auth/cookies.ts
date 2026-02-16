/**
 * Cross-service cookie utilities.
 *
 * When AUTH_COOKIE_DOMAIN is set (e.g. `.example.com`), the session cookie
 * is shared across all subdomains, enabling SSO between services like
 * orders.example.com and inventory.example.com.
 *
 * These helpers build Set-Cookie / clear-cookie header values that work
 * for both same-domain and cross-domain deployments.
 */
import { NextResponse } from "next/server";
import { getAuthConfig } from "./config";
import { createSessionToken } from "./session";

/**
 * Set the session cookie on a NextResponse.
 */
export async function setSessionCookie(
  response: NextResponse,
  sub: string,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const { cookieName, cookieDomain, sessionTTL } = getAuthConfig();
  const token = await createSessionToken(sub, extra);

  response.cookies.set(cookieName, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: sessionTTL,
    secure: process.env.NODE_ENV === "production",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  return response;
}

/**
 * Clear the session cookie on a NextResponse.
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  const { cookieName, cookieDomain } = getAuthConfig();

  response.cookies.set(cookieName, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  return response;
}
