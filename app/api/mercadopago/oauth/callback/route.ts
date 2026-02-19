/**
 * /api/mercadopago/oauth/callback
 *
 * Legacy OAuth callback endpoint kept for backwards compatibility.
 * Preferred callback URL is now GET /api/mercadopago/webhook
 * so MercadoPago app can share one URL for OAuth callback + webhook events.
 */
import { handleOAuthCallback } from "@/lib/services/mercadopago/oauthCallbackHandler";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request);
}
