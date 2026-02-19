/**
 * /api/mercadopago/oauth/callback
 *
 * Handles the OAuth callback from MercadoPago:
 * 1. Validates state parameter
 * 2. Exchanges authorization code for access token
 * 3. Fetches user info
 * 4. Stores credentials in database
 * 5. Redirects back to app with success/error status
 */
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { completeAccessRequest } from "@/lib/services/mercadopago/accessRequestsService";
import { upsertCredentials } from "@/lib/services/mercadopago/credentialsService";
import {
    exchangeCodeForToken,
    getOAuthConfig,
    getUserInfo,
} from "@/lib/services/mercadopago/oauthService";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth error (user declined or MP error)
    if (error) {
      const errorDescription =
        searchParams.get("error_description") ?? "OAuth error";
      console.error("MP OAuth error:", error, errorDescription);

      // Redirect to app with error
      const redirectUrl = new URL(request.nextUrl.origin);
      redirectUrl.searchParams.set("mp_oauth", "error");
      redirectUrl.searchParams.set("message", errorDescription);
      return NextResponse.redirect(redirectUrl);
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 },
      );
    }

    // Validate state (CSRF protection)
    const storedState = request.cookies.get("mp_oauth_state")?.value;
    const tenantId = request.cookies.get("mp_oauth_tenant")?.value;
    const contactEmail = request.cookies.get("mp_oauth_email")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 },
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing tenant context" },
        { status: 400 },
      );
    }

    if (!contactEmail) {
      return NextResponse.json(
        { error: "Missing contact email" },
        { status: 400 },
      );
    }

    // Exchange code for token (pass origin so redirect_uri matches authorize step)
    const origin = new URL(request.url).origin;
    const config = getOAuthConfig({ origin });
    const tokenResponse = await exchangeCodeForToken({ config, code });

    // Fetch user info to get detailed MP user_id
    const userInfo = await getUserInfo({
      accessToken: tokenResponse.access_token,
    });

    // Store credentials
    const creds = await upsertCredentials({
      tenantId,
      accessToken: tokenResponse.access_token,
      appId: config.clientId,
      userId: userInfo.id.toString(),
      contactEmail,
    });

    await completeAccessRequest({ tenantId, contactEmail });

    // Dispatch audit event
    await dispatchDomainEvent({
      type: "mercadopago.credentials.upserted",
      payload: {
        tenantId,
        appId: creds.app_id,
        userId: creds.user_id,
      },
    });

    // Clear OAuth cookies
    const response = NextResponse.redirect(
      new URL("/?mp_oauth=success", request.nextUrl.origin),
    );
    response.cookies.delete("mp_oauth_state");
    response.cookies.delete("mp_oauth_tenant");
    response.cookies.delete("mp_oauth_email");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Redirect to app with error
    const message =
      error instanceof Error ? error.message : "OAuth callback failed";
    const redirectUrl = new URL(request.nextUrl.origin);
    redirectUrl.searchParams.set("mp_oauth", "error");
    redirectUrl.searchParams.set("message", message);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("mp_oauth_state");
    response.cookies.delete("mp_oauth_tenant");
    response.cookies.delete("mp_oauth_email");

    return response;
  }
}
