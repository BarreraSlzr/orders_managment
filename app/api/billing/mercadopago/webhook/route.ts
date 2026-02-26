/**
 * /api/billing/mercadopago/webhook
 *
 * Platform billing webhook — handles subscription lifecycle events from
 * the billing provider (e.g. Mercado Pago Subscriptions or Stripe).
 *
 * This endpoint is SEPARATE from the tenant payment webhook at
 * /api/mercadopago/webhook, which handles per-tenant QR/PDV notifications.
 * Each endpoint uses its OWN HMAC secret:
 *
 *   /api/mercadopago/webhook          → MP_WEBHOOK_SECRET
 *   /api/billing/mercadopago/webhook  → MP_BILLING_WEBHOOK_SECRET
 *
 * Event flow:
 *   Provider → POST /api/billing/mercadopago/webhook
 *     → read raw body (needed for HMAC before parse)
 *     → validate x-signature with MP_BILLING_WEBHOOK_SECRET (when set)
 *     → upsert tenant_subscriptions
 *     → recompute tenant_entitlements
 *     → append tenant_billing_events
 *     → return 200 (always, to avoid retry storms)
 *
 * See docs/MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md for the full design.
 */

import { processBillingEvent } from "@/lib/services/entitlements/billingWebhookService";
import { getMpPlatformConfig } from "@/lib/services/mercadopago/platformConfig";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the x-signature header sent by the billing provider.
 * Uses the same ts=<ms>,v1=<hex> format as the MercadoPago payment webhook.
 * Only runs when MP_BILLING_WEBHOOK_SECRET is set.
 */
function validateBillingSignature(params: {
  xSignature: string;
  xRequestId: string;
  rawBody: string;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, rawBody, secret } = params;

  let ts = "";
  let hash = "";
  for (const part of xSignature.split(",")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") hash = value;
  }

  if (!ts || !hash) return false;

  // Manifest: body + request-id + ts (only non-empty segments)
  const segments: string[] = [];
  if (rawBody) segments.push(`body:${rawBody}`);
  if (xRequestId) segments.push(`request-id:${xRequestId}`);
  if (ts) segments.push(`ts:${ts}`);
  const manifest = segments.join(";") + ";";

  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Read raw body text — needed for HMAC validation before JSON.parse
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    console.error("[billing/webhook] Failed to read request body");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── Signature validation ──────────────────────────────────────────────────
  const { billingWebhookSecret: billingSecret } = await getMpPlatformConfig();
  if (billingSecret) {
    const xSignature = request.headers.get("x-signature") ?? "";
    const xRequestId = request.headers.get("x-request-id") ?? "";

    if (!validateBillingSignature({ xSignature, xRequestId, rawBody, secret: billingSecret })) {
      console.error("[billing/webhook] Signature validation failed");
      // Return 200 to avoid retry storms — log for alerting
      return NextResponse.json({ received: true, error: "invalid_signature" }, { status: 200 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[billing/webhook] Failed to parse JSON body");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    await processBillingEvent(payload);
  } catch (error) {
    // Log but always return 200 — provider should not retry on app errors
    console.error("[billing/webhook] Processing error:", error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
