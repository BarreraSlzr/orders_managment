/**
 * statusService — payment_sync_attempts CRUD.
 *
 * Records each Mercado Pago payment sync attempt for an order, tracking
 * its lifecycle from pending → processing → approved/rejected/canceled/error.
 * Idempotency: only one non-terminal attempt per order is allowed.
 */
import { getDb } from "@/lib/sql/database";
import { PaymentSyncAttemptsTable } from "@/lib/sql/types";
import { Selectable } from "kysely";
import { getCredentials } from "./credentialsService";
import { cancelPDVPaymentIntent } from "./paymentService";

export type SyncAttempt = Selectable<PaymentSyncAttemptsTable>;
export type SyncAttemptStatus = PaymentSyncAttemptsTable["status"];

/** Terminal statuses — no further transitions expected. */
const TERMINAL_STATUSES: SyncAttemptStatus[] = [
  "approved",
  "rejected",
  "canceled",
  "error",
];

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateAttemptParams {
  tenantId: string;
  orderId: string;
  amountCents: number;
  terminalId?: string;
}

/**
 * Creates a new pending sync attempt.
 * Throws if a non-terminal attempt already exists for the order (idempotency guard).
 */
export async function createAttempt({
  tenantId,
  orderId,
  amountCents,
  terminalId,
}: CreateAttemptParams): Promise<SyncAttempt> {
  // Idempotency: block duplicate active attempts
  const existing = await getDb()
    .selectFrom("payment_sync_attempts")
    .select(["id", "status"])
    .where("tenant_id", "=", tenantId)
    .where("order_id", "=", orderId)
    .where("status", "not in", TERMINAL_STATUSES)
    .executeTakeFirst();

  if (existing) {
    throw new Error(
      `A payment attempt for order ${orderId} is already in progress (id=${existing.id}, status=${existing.status}). Cancel it before retrying.`,
    );
  }

  const row = await getDb()
    .insertInto("payment_sync_attempts")
    .values({
      tenant_id: tenantId,
      order_id: orderId,
      amount_cents: amountCents,
      status: "pending",
      terminal_id: terminalId ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return row;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export interface UpdateAttemptParams {
  id: number;
  status: SyncAttemptStatus;
  mpTransactionId?: string;
  qrCode?: string;
  terminalId?: string;
  responseData?: Record<string, unknown>;
  errorData?: Record<string, unknown>;
  /** MP notification id for webhook deduplication. */
  lastMpNotificationId?: string;
  /** Timestamp of the successfully processed notification. */
  lastProcessedAt?: Date;
}

/**
 * Updates an attempt's status and optional metadata.
 * Pass `lastMpNotificationId` + `lastProcessedAt` from webhook handlers to
 * record the notification that caused the transition (deduplication guard).
 */
export async function updateAttempt({
  id,
  status,
  mpTransactionId,
  qrCode,
  terminalId,
  responseData,
  errorData,
  lastMpNotificationId,
  lastProcessedAt,
}: UpdateAttemptParams): Promise<void> {
  await getDb()
    .updateTable("payment_sync_attempts")
    .set({
      status,
      ...(mpTransactionId !== undefined && {
        mp_transaction_id: mpTransactionId,
      }),
      ...(qrCode !== undefined && { qr_code: qrCode }),
      ...(terminalId !== undefined && { terminal_id: terminalId }),
      ...(responseData !== undefined && { response_data: responseData }),
      ...(errorData !== undefined && { error_data: errorData }),
      ...(lastMpNotificationId !== undefined && {
        last_mp_notification_id: lastMpNotificationId,
      }),
      ...(lastProcessedAt !== undefined && {
        last_processed_at: lastProcessedAt,
      }),
    })
    .where("id", "=", id)
    .execute();
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Returns the single attempt by id (tenant-scoped).
 */
export async function getAttempt({
  id,
  tenantId,
}: {
  id: number;
  tenantId: string;
}): Promise<SyncAttempt | null> {
  const row = await getDb()
    .selectFrom("payment_sync_attempts")
    .selectAll()
    .where("id", "=", id)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  return row ?? null;
}

/**
 * Returns the most recent sync attempt for an order, regardless of status.
 */
export async function getLatestAttempt({
  orderId,
  tenantId,
}: {
  orderId: string;
  tenantId: string;
}): Promise<SyncAttempt | null> {
  const row = await getDb()
    .selectFrom("payment_sync_attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("order_id", "=", orderId)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  return row ?? null;
}

/**
 * Cancels any non-terminal attempt for an order (allows retry).
 *
 * When the active attempt has a `terminal_id` + `mp_transaction_id` (PDV /
 * Point Smart flow) we also send a best-effort cancel to the Mercado Pago API
 * so the terminal stops waiting for the customer tap.
 */
export async function cancelActiveAttempt({
  orderId,
  tenantId,
}: {
  orderId: string;
  tenantId: string;
}): Promise<void> {
  // 1. Read the active attempt to obtain terminal / intent ids
  const active = await getDb()
    .selectFrom("payment_sync_attempts")
    .select(["id", "terminal_id", "mp_transaction_id"])
    .where("tenant_id", "=", tenantId)
    .where("order_id", "=", orderId)
    .where("status", "not in", TERMINAL_STATUSES)
    .executeTakeFirst();

  if (!active) return; // nothing to cancel

  // 2. Best-effort: cancel the PDV payment intent on the MP terminal
  if (active.terminal_id && active.mp_transaction_id) {
    try {
      const creds = await getCredentials({ tenantId });
      if (creds?.access_token) {
        await cancelPDVPaymentIntent({
          accessToken: creds.access_token,
          deviceId: active.terminal_id,
          intentId: active.mp_transaction_id,
        });
      }
    } catch (error) {
      console.warn(
        `[statusService] Best-effort PDV cancel failed for attempt ${active.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 3. Mark the row as canceled in the DB
  await getDb()
    .updateTable("payment_sync_attempts")
    .set({ status: "canceled" })
    .where("id", "=", active.id)
    .execute();
}
