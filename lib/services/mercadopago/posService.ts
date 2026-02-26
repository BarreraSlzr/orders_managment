/**
 * posService — Mercado Pago Point-of-Sale management.
 *
 * POS entities represent cash registers or checkout points within a store.
 * Each POS has an `external_id` used as the `external_pos_id` in the
 * QR payment flow endpoint.
 *
 * Quality checklist item: `API for POS creation`
 * Reference: https://www.mercadopago.com.mx/developers/en/reference/pos/_pos/post
 */

import { mpFetch } from "./mpFetch";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpPos {
  id: number;
  name: string;
  external_id: string;
  store_id?: string;
  category?: number;
  fixed_amount?: boolean;
  date_created: string;
  date_last_updated: string;
  uuid?: string;
  /** QR data for this POS (returned on creation) */
  qr?: {
    image: string;
    template_document: string;
    template_image: string;
  };
}

export interface CreatePosParams {
  accessToken: string;
  /** Human-readable POS name (e.g. "Caja 1") */
  name: string;
  /**
   * Unique external identifier — this becomes the `external_pos_id` used
   * in the QR payment endpoint path.
   */
  externalId: string;
  /** Store ID to associate this POS with */
  storeId?: string;
  /** MCC category code (default: 621102 — marketplace) */
  category?: number;
  /** Whether this POS uses a fixed amount (default: false) */
  fixedAmount?: boolean;
}

export interface UpdatePosParams {
  accessToken: string;
  posId: number;
  name?: string;
  externalId?: string;
  storeId?: string;
  category?: number;
  fixedAmount?: boolean;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Creates a new Point-of-Sale.
 * Endpoint: POST /pos
 *
 * The returned `external_id` is used as `external_pos_id` in the QR flow:
 * POST /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
 */
export async function createPos({
  accessToken,
  name,
  externalId,
  storeId,
  category = 621102,
  fixedAmount = false,
}: CreatePosParams): Promise<MpPos> {
  const body: Record<string, unknown> = {
    name,
    external_id: externalId,
    category,
    fixed_amount: fixedAmount,
  };

  if (storeId) {
    body.store_id = storeId;
  }

  return mpFetch<MpPos>({
    accessToken,
    method: "POST",
    path: "/pos",
    body,
  });
}

/**
 * Lists all POS entries for the authenticated user.
 * Endpoint: GET /pos
 *
 * Supports optional filtering by store_id or external_id.
 */
export async function listPos({
  accessToken,
  storeId,
  externalId,
}: {
  accessToken: string;
  storeId?: string;
  externalId?: string;
}): Promise<MpPos[]> {
  const params = new URLSearchParams();
  if (storeId) params.set("store_id", storeId);
  if (externalId) params.set("external_id", externalId);

  const query = params.toString();
  const path = query ? `/pos?${query}` : "/pos";

  const data = await mpFetch<{ results?: MpPos[]; paging?: unknown }>({
    accessToken,
    path,
  });
  return data.results ?? [];
}

/**
 * Updates an existing POS.
 * Endpoint: PUT /pos/{pos_id}
 */
export async function updatePos({
  accessToken,
  posId,
  name,
  externalId,
  storeId,
  category,
  fixedAmount,
}: UpdatePosParams): Promise<MpPos> {
  const body: Record<string, unknown> = {};
  if (name !== undefined) body.name = name;
  if (externalId !== undefined) body.external_id = externalId;
  if (storeId !== undefined) body.store_id = storeId;
  if (category !== undefined) body.category = category;
  if (fixedAmount !== undefined) body.fixed_amount = fixedAmount;

  return mpFetch<MpPos>({
    accessToken,
    method: "PUT",
    path: `/pos/${posId}`,
    body,
  });
}

/**
 * Deletes a POS.
 * Endpoint: DELETE /pos/{pos_id}
 */
export async function deletePos({
  accessToken,
  posId,
}: {
  accessToken: string;
  posId: number;
}): Promise<void> {
  await mpFetch<unknown>({
    accessToken,
    method: "DELETE",
    path: `/pos/${posId}`,
  });
}
