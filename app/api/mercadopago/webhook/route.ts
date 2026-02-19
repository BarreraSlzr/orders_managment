/**
 * POST /api/mercadopago/webhook
 *
 * Production webhook endpoint for MercadoPago notifications.
 *
 * Flow:
 *  1. Validates `x-signature` HMAC when MP_WEBHOOK_SECRET is set.
 *  2. Resolves tenant from `user_id` in the notification payload
 *     → cross-references `mercadopago_credentials.user_id`.
 *  3. Delegates to the appropriate handler by notification `type`.
 *  4. Always returns 200 to prevent MercadoPago from retrying
 *     endlessly on non-recoverable errors.
 *
 * MercadoPago retries on non-2xx every 15 min for up to 3 days.
 * It expects a response within 22 seconds.
 */
import {
  processWebhook,
  validateWebhookSignature,
  type MpWebhookNotification,
} from "@/lib/services/mercadopago/webhookService";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MpWebhookNotification;

    // ── Signature validation ──────────────────────────────────────────
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
      const xSignature = request.headers.get("x-signature") ?? "";
      const xRequestId = request.headers.get("x-request-id") ?? "";

      if (
        !validateWebhookSignature({
          xSignature,
          xRequestId,
          dataId: body.data?.id ?? "",
          secret,
        })
      ) {
        console.error(
          "[MP webhook] Signature validation failed",
          JSON.stringify({ type: body.type, action: body.action }),
        );
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

    // ── Process ───────────────────────────────────────────────────────
    const result = await processWebhook({ notification: body });

    if (!result.ok) {
      console.warn(
        `[MP webhook] Not fully processed: ${result.detail}`,
        JSON.stringify({
          type: body.type,
          action: body.action,
          user_id: body.user_id,
        }),
      );
    }

    // Always return 200 — MP will retry on non-2xx
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[MP webhook] Unhandled error:", error);
    // Return 200 to stop retries on non-transient errors.
    // Persistent failures surface through logging / monitoring.
    return NextResponse.json(
      { received: true, error: "Internal processing error" },
      { status: 200 },
    );
  }
}
