/**
 * POST /api/mercadopago/webhook/test
 *
 * Test / sandbox webhook endpoint.  Same processing logic as the production
 * endpoint but **skips** `x-signature` validation so you can fire test
 * notifications from the MercadoPago developer dashboard without configuring
 * a webhook secret.
 */
import {
  processWebhook,
  type MpWebhookNotification,
} from "@/lib/services/mercadopago/webhookService";
import { NextRequest, NextResponse } from "next/server";

function resolveConfiguredTestPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;

  try {
    return new URL(trimmed).pathname;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const configured = process.env.MP_REDIRECT_TEST_URI;
    if (!configured) {
      console.error("[MP webhook/test] Missing MP_REDIRECT_TEST_URI");
      return NextResponse.json(
        { error: "MP_REDIRECT_TEST_URI environment variable is required" },
        { status: 500 },
      );
    }

    const configuredPath = resolveConfiguredTestPath(configured);
    if (!configuredPath) {
      console.error(
        "[MP webhook/test] Invalid MP_REDIRECT_TEST_URI",
        JSON.stringify({ configured }),
      );
      return NextResponse.json(
        {
          error:
            "MP_REDIRECT_TEST_URI must be a valid absolute URL or path starting with '/'",
        },
        { status: 500 },
      );
    }

    const requestPath = request.nextUrl.pathname;
    if (configuredPath !== requestPath) {
      console.error(
        "[MP webhook/test] Path mismatch",
        JSON.stringify({ configuredPath, requestPath }),
      );
      return NextResponse.json(
        {
          error:
            "MP_REDIRECT_TEST_URI does not match this route path. Check MercadoPago test webhook URL configuration.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as MpWebhookNotification;

    const result = await processWebhook({ notification: body });

    if (!result.ok) {
      console.warn(
        `[MP webhook/test] Not fully processed: ${result.detail}`,
        JSON.stringify({
          type: body.type,
          action: body.action,
          user_id: body.user_id,
        }),
      );
    }

    return NextResponse.json(
      { received: true, test: true, ...result },
      { status: 200 },
    );
  } catch (error) {
    console.error("[MP webhook/test] Unhandled error:", error);
    return NextResponse.json(
      { received: true, test: true, error: "Internal processing error" },
      { status: 200 },
    );
  }
}
