/**
 * webhookService — MercadoPago webhook processing.
 *
 * Handles incoming webhook notifications from MercadoPago:
 *  1. Validates x-signature HMAC (production security)
 *  2. Resolves tenant by mp user_id + contact_email cross-reference
 *  3. Routes events by type → payment | point_integration | mp-connect
 *
 * Tenant resolution uses `mercadopago_credentials.user_id` (the MP account
 * owner) which is populated during OAuth onboarding.  The `contact_email`
 * stored in credentials allows human-readable identification when debugging.
 *
 * References:
 *   https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks
 *   https://www.mercadopago.com.mx/developers/en/docs/mp-point/integration-configuration/integrate-with-pdv/notifications
 */
import { getDb } from "@/lib/sql/database";
import type { PaymentSyncAttemptsTable } from "@/lib/sql/types";
import { createHmac, timingSafeEqual } from "crypto";
import { getCredentials, MpCredentials } from "./credentialsService";
import { updateAttempt } from "./statusService";

type SyncAttemptStatus = PaymentSyncAttemptsTable["status"];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpWebhookNotification {
  id: number | string;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

export interface MpPaymentDetails {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  payment_method_id: string;
  date_approved: string | null;
  date_created: string;
}

// ─── Signature Validation ────────────────────────────────────────────────────

/**
 * Validates the `x-signature` HMAC header sent by MercadoPago.
 *
 * Header format: `ts=<unix_ms>,v1=<hex_hmac>`
 * Manifest:      `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *
 * Only segments with actual values are included in the manifest.
 */
export function validateWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;

  // Parse ts and v1 from x-signature header
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

  // Build manifest — only include segments that have values
  const segments: string[] = [];
  if (dataId) segments.push(`id:${dataId}`);
  if (xRequestId) segments.push(`request-id:${xRequestId}`);
  if (ts) segments.push(`ts:${ts}`);
  const manifest = segments.join(";") + ";";

  // HMAC-SHA256 with the webhook secret — timing-safe comparison
  const computed = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// ─── Tenant Resolution ──────────────────────────────────────────────────────

export interface ResolvedTenant {
  tenantId: string;
  credentials: MpCredentials;
}

/**
 * Resolves the tenant that owns this webhook event.
 *
 * Lookup chain:
 *  1. `mercadopago_credentials.user_id` = MP user_id from notification
 *  2. Falls back to `contact_email` if provided (secondary match)
 *
 * Returns null when no active credentials match — the webhook is
 * acknowledged (200) but not processed to avoid infinite retries.
 */
export async function resolveWebhookTenant(params: {
  mpUserId: string;
  contactEmail?: string;
}): Promise<ResolvedTenant | null> {
  const { mpUserId, contactEmail } = params;

  // Primary: match by MP user_id
  let row = await getDb()
    .selectFrom("mercadopago_credentials")
    .selectAll()
    .where("user_id", "=", mpUserId)
    .where("status", "=", "active")
    .where("deleted", "is", null)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  // Secondary fallback: match by contact_email
  if (!row && contactEmail) {
    row = await getDb()
      .selectFrom("mercadopago_credentials")
      .selectAll()
      .where("contact_email", "=", contactEmail)
      .where("status", "=", "active")
      .where("deleted", "is", null)
      .orderBy("created", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  if (!row) return null;

  return { tenantId: row.tenant_id, credentials: row };
}

// ─── MP API: Payment Details ─────────────────────────────────────────────────

const MP_BASE_URL = "https://api.mercadopago.com";

/** Timeout for MP API calls during webhook processing (15s). */
const MP_WEBHOOK_FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches full payment details from the Payments API.
 * Required for `payment` webhook events where we need `external_reference`
 * (our orderId) and `status` to update `payment_sync_attempts`.
 */
export async function fetchPaymentDetails(params: {
  accessToken: string;
  paymentId: string;
}): Promise<MpPaymentDetails> {
  const { accessToken, paymentId } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MP_WEBHOOK_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch payment ${paymentId}: ${txt}`);
  }

  return (await res.json()) as MpPaymentDetails;
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

const MP_STATUS_TO_SYNC: Record<string, SyncAttemptStatus> = {
  approved: "approved",
  authorized: "approved",
  in_process: "processing",
  in_mediation: "processing",
  pending: "pending",
  rejected: "rejected",
  cancelled: "canceled",
  refunded: "canceled",
  charged_back: "error",
};

function mapMpStatus(mpStatus: string): SyncAttemptStatus {
  return MP_STATUS_TO_SYNC[mpStatus] ?? "error";
}

// ─── Terminal statuses (no further transitions expected) ─────────────────────

const TERMINAL_STATUSES: SyncAttemptStatus[] = [
  "approved",
  "rejected",
  "canceled",
  "error",
];

// ─── Event Handlers ──────────────────────────────────────────────────────────

export interface WebhookHandlerResult {
  handled: boolean;
  detail?: string;
}

/**
 * Handles `type: "payment"` webhooks.
 * Fetches the full payment from MP API, maps status, updates sync attempt.
 */
export async function handlePaymentEvent(params: {
  notification: MpWebhookNotification;
  credentials: MpCredentials;
  tenantId: string;
}): Promise<WebhookHandlerResult> {
  const { notification, credentials, tenantId } = params;

  const activeCreds = await getCredentials({ tenantId });
  const accessToken = activeCreds?.access_token ?? credentials.access_token;

  let payment: MpPaymentDetails;
  try {
    payment = await fetchPaymentDetails({
      accessToken,
      paymentId: notification.data.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown fetch error";
    console.error(
      `[webhook] fetchPaymentDetails failed for notification ${notification.id}:`,
      msg,
    );
    return {
      handled: false,
      detail: `Failed to fetch payment ${notification.data.id}: ${msg}`,
    };
  }

  const orderId = payment.external_reference;
  if (!orderId) {
    return { handled: false, detail: "No external_reference in payment" };
  }

  // Find the active (non-terminal) sync attempt for this order
  const attempt = await getDb()
    .selectFrom("payment_sync_attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("order_id", "=", orderId)
    .where("status", "not in", TERMINAL_STATUSES)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!attempt) {
    return { handled: false, detail: `No active attempt for order ${orderId}` };
  }

  // ── Idempotency guard ────────────────────────────────────────────────────
  // If this notification was already applied, skip processing silently.
  const notificationId = notification.id.toString();
  if (attempt.last_mp_notification_id === notificationId) {
    return {
      handled: true,
      detail: `Duplicate payment notification ${notificationId} — already processed`,
    };
  }

  const newStatus = mapMpStatus(payment.status);

  await updateAttempt({
    id: attempt.id,
    status: newStatus,
    mpTransactionId: payment.id.toString(),
    responseData: payment as unknown as Record<string, unknown>,
    lastMpNotificationId: notificationId,
    lastProcessedAt: new Date(),
  });

  return { handled: true, detail: `Payment ${payment.id} → ${newStatus}` };
}

/**
 * Handles `type: "point_integration_wh"` webhooks (Point terminal events).
 * Maps action → sync attempt status by `mp_transaction_id`.
 */
export async function handlePointIntegrationEvent(params: {
  notification: MpWebhookNotification;
  credentials: MpCredentials;
  tenantId: string;
}): Promise<WebhookHandlerResult> {
  const { notification, tenantId } = params;
  const intentId = notification.data.id;
  const action = notification.action;

  // Map point integration actions to our status
  let newStatus: SyncAttemptStatus;
  if (action === "state_FINISHED") {
    newStatus = "approved";
  } else if (action === "state_CANCELED") {
    newStatus = "canceled";
  } else if (action === "state_ERROR") {
    newStatus = "error";
  } else {
    // Acknowledge but don't process unknown actions
    return { handled: true, detail: `Ignored point action: ${action}` };
  }

  // Find attempt by mp_transaction_id (the payment intent id)
  const attempt = await getDb()
    .selectFrom("payment_sync_attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("mp_transaction_id", "=", intentId)
    .where("status", "not in", TERMINAL_STATUSES)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!attempt) {
    return {
      handled: false,
      detail: `No active attempt for intent ${intentId}`,
    };
  }

  // ── Idempotency guard ────────────────────────────────────────────────────
  const notificationId = notification.id.toString();
  if (attempt.last_mp_notification_id === notificationId) {
    return {
      handled: true,
      detail: `Duplicate point notification ${notificationId} — already processed`,
    };
  }

  await updateAttempt({
    id: attempt.id,
    status: newStatus,
    responseData: notification as unknown as Record<string, unknown>,
    lastMpNotificationId: notificationId,
    lastProcessedAt: new Date(),
  });

  return { handled: true, detail: `Point intent ${intentId} → ${newStatus}` };
}

/**
 * Handles `type: "mp-connect"` webhooks (OAuth lifecycle).
 *
 * `application.deauthorized` → mark tenant credentials inactive.
 */
export async function handleMpConnectEvent(params: {
  notification: MpWebhookNotification;
  tenantId: string;
}): Promise<WebhookHandlerResult> {
  const { notification, tenantId } = params;

  if (notification.action === "application.deauthorized") {
    await getDb()
      .updateTable("mercadopago_credentials")
      .set({ status: "inactive" })
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "active")
      .execute();

    return { handled: true, detail: "Credentials deauthorized" };
  }

  return {
    handled: true,
    detail: `mp-connect action: ${notification.action}`,
  };
}

// ─── Main Processor ──────────────────────────────────────────────────────────

export interface ProcessWebhookResult {
  ok: boolean;
  tenantId?: string;
  type: string;
  detail?: string;
}

/**
 * Central webhook dispatcher.
 *
 * 1. Resolves tenant from `user_id` (+ optional email fallback).
 * 2. Delegates to the type-specific handler.
 * 3. Returns a result struct for the route handler to log / respond.
 */
export async function processWebhook(params: {
  notification: MpWebhookNotification;
}): Promise<ProcessWebhookResult> {
  const { notification } = params;
  const mpUserId = notification.user_id.toString();

  // Resolve tenant
  const resolved = await resolveWebhookTenant({ mpUserId });
  if (!resolved) {
    return {
      ok: false,
      type: notification.type,
      detail: `No tenant found for MP user_id=${mpUserId}`,
    };
  }

  const { tenantId, credentials } = resolved;

  // Route by event type
  let result: WebhookHandlerResult;

  switch (notification.type) {
    case "payment":
      result = await handlePaymentEvent({
        notification,
        credentials,
        tenantId,
      });
      break;

    case "point_integration_wh":
      result = await handlePointIntegrationEvent({
        notification,
        credentials,
        tenantId,
      });
      break;

    case "mp-connect":
      result = await handleMpConnectEvent({ notification, tenantId });
      break;

    default:
      // Acknowledge all other types to prevent MP retries
      result = {
        handled: true,
        detail: `Acknowledged unhandled type: ${notification.type}`,
      };
      break;
  }

  return {
    ok: result.handled,
    tenantId,
    type: notification.type,
    detail: result.detail,
  };
}
