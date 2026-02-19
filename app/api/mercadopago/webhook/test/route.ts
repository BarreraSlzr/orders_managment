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

export async function POST(request: NextRequest) {
  try {
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
