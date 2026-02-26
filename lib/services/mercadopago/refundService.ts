/**
 * refundService — Mercado Pago payment refund operations.
 *
 * Supports full and partial refunds via the Payments Refunds API.
 *
 * Quality checklist items: `refunds`, `refunds_api`
 * Reference: https://www.mercadopago.com.mx/developers/en/reference/chargebacks/_payments_id_refunds/post
 */

import { mpFetch } from "./mpFetch";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpRefund {
  id: number;
  payment_id: number;
  amount: number;
  status: "approved" | "in_process" | "rejected";
  date_created: string;
  source: {
    id: string;
    name: string;
    type: string;
  };
}

export interface CreateRefundParams {
  accessToken: string;
  /** MP payment ID to refund */
  paymentId: string;
  /** Amount to refund in decimal (e.g. 15.50). Omit for full refund. */
  amount?: number;
}

// ─── Operations ──────────────────────────────────────────────────────────────

/**
 * Creates a full or partial refund for a payment.
 * Endpoint: POST /v1/payments/{payment_id}/refunds
 *
 * - Omit `amount` for a full refund of the entire payment.
 * - Provide `amount` for a partial refund (e.g. single item).
 */
export async function createRefund({
  accessToken,
  paymentId,
  amount,
}: CreateRefundParams): Promise<MpRefund> {
  const body: Record<string, unknown> = {};
  if (amount !== undefined) {
    body.amount = amount;
  }

  return mpFetch<MpRefund>({
    accessToken,
    method: "POST",
    path: `/v1/payments/${paymentId}/refunds`,
    body: Object.keys(body).length > 0 ? body : undefined,
    extraHeaders: {
      "X-Idempotency-Key": crypto.randomUUID(),
    },
  });
}

/**
 * Lists all refunds for a payment.
 * Endpoint: GET /v1/payments/{payment_id}/refunds
 */
export async function listRefunds({
  accessToken,
  paymentId,
}: {
  accessToken: string;
  paymentId: string;
}): Promise<MpRefund[]> {
  return mpFetch<MpRefund[]>({
    accessToken,
    path: `/v1/payments/${paymentId}/refunds`,
  });
}

/**
 * Gets a specific refund by ID.
 * Endpoint: GET /v1/payments/{payment_id}/refunds/{refund_id}
 */
export async function getRefund({
  accessToken,
  paymentId,
  refundId,
}: {
  accessToken: string;
  paymentId: string;
  refundId: string;
}): Promise<MpRefund> {
  return mpFetch<MpRefund>({
    accessToken,
    path: `/v1/payments/${paymentId}/refunds/${refundId}`,
  });
}
