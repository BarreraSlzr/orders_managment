/**
 * /api/mercadopago/oauth/authorize
 *
 * Initiates the MercadoPago OAuth flow by:
 * 1. Generating a secure state parameter
 * 2. Storing state in session/cookie with tenant_id
 * 3. Redirecting to MercadoPago authorization URL
 */
import { verifySessionToken } from "@/lib/auth/session";
import {
    checkMpEntitlement,
    mpEntitlementMessage,
} from "@/lib/services/entitlements/checkEntitlement";
import {
    generateOAuthState,
    getAuthorizeUrl,
    getOAuthConfig,
} from "@/lib/services/mercadopago/oauthService";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";

    if (!contactEmail) {
      return NextResponse.json(
        { error: "Contact email is required" },
        { status: 400 },
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(contactEmail)) {
      return NextResponse.json(
        { error: "Contact email is invalid" },
        { status: 400 },
      );
    }

    // Get authenticated user from session cookie
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const session = await verifySessionToken(sessionToken);
    if (!session?.tenant_id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Entitlement check — blocks OAuth connect when subscription inactive
    const ent = await checkMpEntitlement({ tenantId: session.tenant_id });
    if (!ent.allowed) {
      const redirectUrl = new URL(request.url);
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("mp_oauth", "entitlement_error");
      redirectUrl.searchParams.set("message", mpEntitlementMessage(ent.reason ?? "none"));
      return NextResponse.redirect(redirectUrl);
    }

    // Generate OAuth state for CSRF protection
    const state = generateOAuthState();

    // Get OAuth config (pass origin so relative redirect URI becomes absolute)
    const origin = new URL(request.url).origin;
    const config = getOAuthConfig({ origin });

    // Generate authorization URL
    const authorizeUrl = getAuthorizeUrl({ config, state });

    // Store state in cookie with tenant_id for validation in callback
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set("mp_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    response.cookies.set("mp_oauth_tenant", session.tenant_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    response.cookies.set("mp_oauth_email", contactEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OAuth authorize error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to initiate OAuth";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
