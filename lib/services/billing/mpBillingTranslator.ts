/**
 * mpBillingTranslator — converts raw MercadoPago subscription webhook
 * notifications into the provider-agnostic BillingEvent envelope expected
 * by processBillingEvent().
 *
 * MercadoPago sends notifications with this shape:
 *   { type, action, data: { id }, id, user_id, live_mode, ... }
 *
 * We need to:
 *  1. Identify the notification type (subscription_preapproval, etc.)
 *  2. Fetch the full subscription from MP API to get external_reference (= tenantId)
 *  3. Map the MP subscription status to our BillingEvent status
 *  4. Return a BillingEvent or null (when the notification is not actionable)
 *
 * LEGEND: Canonical MP billing notification translator.
 */

import type { BillingEvent } from "@/lib/services/entitlements/billingWebhookService";
import { fetchSubscriptionDetails } from "./subscriptionService";

// ─── Raw MP notification shape ───────────────────────────────────────────────

interface MpBillingNotification {
  id: number | string;
  type: string;
  action?: string;
  data?: { id?: string | number };
  user_id?: number;
  live_mode?: boolean;
  date_created?: string;
  api_version?: string;
}

// ─── Status mapping ──────────────────────────────────────────────────────────

/**
 * Maps MercadoPago preapproval status strings to BillingEvent status values.
 *
 * MP statuses (from /preapproval docs):
 *   pending     — subscription created, awaiting first payment
 *   authorized  — subscription active and payments being charged
 *   paused      — subscription paused by payer or platform
 *   cancelled   — subscription cancelled
 *
 * MP authorized_payment statuses:
 *   approved    — payment went through
 *   pending     — payment pending
 *   in_process  — payment in process
 *   rejected    — payment rejected
 */
const MP_SUBSCRIPTION_STATUS_MAP: Record<string, BillingEvent["status"]> = {
  authorized: "active",
  pending: "active",        // treat as active — first payment still processing
  paused: "past_due",
  cancelled: "canceled",
};

/**
 * Maps MP authorized_payment statuses.
 * Only "rejected" is actionable — triggers past_due.
 */
const MP_PAYMENT_STATUS_MAP: Record<string, BillingEvent["status"] | null> = {
  approved: null,           // no status change needed — subscription stays active
  pending: null,
  in_process: null,
  rejected: "past_due",
};

// ─── Event type mapping ──────────────────────────────────────────────────────

function mapEventType(params: { mpType: string; mpAction?: string }): string {
  const { mpType, mpAction } = params;
  const key = mpAction ? `${mpType}.${mpAction}` : mpType;

  const mapping: Record<string, string> = {
    "subscription_preapproval.updated": "subscription.updated",
    "subscription_preapproval.created": "subscription.activated",
    "subscription_authorized_payment.created": "subscription.payment_created",
    "subscription_authorized_payment.updated": "subscription.payment_updated",
    "subscription_preapproval_plan.updated": "subscription.plan_updated",
  };

  return mapping[key] ?? `mp.${key}`;
}

// ─── Translator ──────────────────────────────────────────────────────────────

export interface TranslateMpBillingParams {
  /** Raw parsed JSON from MP webhook POST body */
  payload: unknown;
  /** Platform billing access token for fetching subscription details */
  accessToken: string;
}

/**
 * Translates a raw MercadoPago billing notification into a BillingEvent.
 *
 * Returns null when:
 *  - The notification type is not subscription-related
 *  - The subscription cannot be fetched (logs warning)
 *  - The notification is a test event
 *  - No status change is needed (e.g. approved payment on an active sub)
 */
export async function translateMpBillingNotification(
  params: TranslateMpBillingParams,
): Promise<BillingEvent | null> {
  const { payload, accessToken } = params;
  const notif = payload as MpBillingNotification;

  // ── Skip non-subscription types ────────────────────────────────────────
  const subscriptionTypes = new Set([
    "subscription_preapproval",
    "subscription_preapproval_plan",
    "subscription_authorized_payment",
  ]);

  if (!notif?.type || !subscriptionTypes.has(notif.type)) {
    console.info(
      `[mpBillingTranslator] Ignoring non-subscription notification type: ${notif?.type ?? "unknown"}`,
    );
    return null;
  }

  // ── Skip test events ──────────────────────────────────────────────────
  if (notif.action === "test.created" || notif.type === "test") {
    console.info("[mpBillingTranslator] Skipping test notification");
    return null;
  }

  // ── Extract subscription ID ───────────────────────────────────────────
  const dataId = notif.data?.id != null ? String(notif.data.id) : "";
  if (!dataId) {
    console.warn("[mpBillingTranslator] No data.id in notification:", notif.id);
    return null;
  }

  // ── For subscription_authorized_payment, data.id is the PAYMENT id,
  //    not the subscription id. We still fetch it as a payment to check
  //    status, but we need to resolve the subscription differently.
  if (notif.type === "subscription_authorized_payment") {
    return handleAuthorizedPayment({ notif, dataId, accessToken });
  }

  // ── For plan updates, we don't have a subscription to fetch ──────────
  if (notif.type === "subscription_preapproval_plan") {
    console.info(`[mpBillingTranslator] Plan update ${dataId} — no tenant action needed`);
    return null;
  }

  // ── Fetch subscription details from MP API ────────────────────────────
  let sub: Awaited<ReturnType<typeof fetchSubscriptionDetails>>;
  try {
    sub = await fetchSubscriptionDetails({
      accessToken,
      subscriptionId: dataId,
    });
  } catch (error) {
    console.error(
      `[mpBillingTranslator] Failed to fetch subscription ${dataId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const tenantId = sub.external_reference?.trim();
  if (!tenantId) {
    console.warn(
      `[mpBillingTranslator] Subscription ${dataId} has no external_reference (tenantId)`,
    );
    return null;
  }

  // ── Map status ────────────────────────────────────────────────────────
  const mappedStatus = MP_SUBSCRIPTION_STATUS_MAP[sub.status] ?? "none";

  return {
    tenantId,
    provider: "mercadopago",
    eventType: mapEventType({ mpType: notif.type, mpAction: notif.action }),
    externalSubscriptionId: sub.id,
    externalEventId: String(notif.id),
    status: mappedStatus,
    currentPeriodEnd: sub.next_payment_date ?? undefined,
    metadata: {
      mp_notification_id: notif.id,
      mp_type: notif.type,
      mp_action: notif.action,
      mp_status: sub.status,
      payer_email: sub.payer_email,
      live_mode: notif.live_mode,
    },
  };
}

// ─── Authorized payment sub-handler ──────────────────────────────────────────

async function handleAuthorizedPayment(params: {
  notif: MpBillingNotification;
  dataId: string;
  accessToken: string;
}): Promise<BillingEvent | null> {
  const { notif, dataId, accessToken } = params;

  // For authorized_payment events, the data.id is the authorized_payment id.
  // We need to fetch it from /authorized_payments/{id} to get the
  // preapproval_id and payment status.
  let paymentInfo: {
    id: string;
    status: string;
    preapproval_id?: string;
    external_reference?: string;
  };

  try {
    paymentInfo = await (await import("@/lib/services/mercadopago/mpFetch")).mpFetch({
      accessToken,
      method: "GET",
      path: `/authorized_payments/${dataId}`,
    });
  } catch (error) {
    console.error(
      `[mpBillingTranslator] Failed to fetch authorized_payment ${dataId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const subscriptionId = paymentInfo.preapproval_id;
  if (!subscriptionId) {
    console.warn(
      `[mpBillingTranslator] authorized_payment ${dataId} has no preapproval_id`,
    );
    return null;
  }

  // Fetch the parent subscription to get external_reference (tenantId)
  let sub: Awaited<ReturnType<typeof fetchSubscriptionDetails>>;
  try {
    sub = await fetchSubscriptionDetails({ accessToken, subscriptionId });
  } catch (error) {
    console.error(
      `[mpBillingTranslator] Failed to fetch subscription ${subscriptionId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const tenantId = sub.external_reference?.trim();
  if (!tenantId) {
    console.warn(
      `[mpBillingTranslator] Subscription ${subscriptionId} has no external_reference`,
    );
    return null;
  }

  // Map authorized payment status
  const mappedStatus = MP_PAYMENT_STATUS_MAP[paymentInfo.status];
  if (mappedStatus === null) {
    // No status change needed (e.g. approved payment = sub stays active)
    console.info(
      `[mpBillingTranslator] authorized_payment ${dataId} status=${paymentInfo.status} — no entitlement change`,
    );
    return null;
  }

  return {
    tenantId,
    provider: "mercadopago",
    eventType: mapEventType({ mpType: notif.type, mpAction: notif.action }),
    externalSubscriptionId: sub.id,
    externalEventId: String(notif.id),
    status: mappedStatus ?? "none",
    currentPeriodEnd: sub.next_payment_date ?? undefined,
    metadata: {
      mp_notification_id: notif.id,
      mp_type: notif.type,
      mp_action: notif.action,
      mp_payment_id: dataId,
      mp_payment_status: paymentInfo.status,
      payer_email: sub.payer_email,
      live_mode: notif.live_mode,
    },
  };
}
