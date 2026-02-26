/**
 * storeService — Mercado Pago Store/Branch management.
 *
 * MP requires stores to be provisioned via API for proper reconciliation
 * and POS assignment. Each store represents a physical location.
 *
 * Quality checklist item: `API for store creation`
 * Reference: https://www.mercadopago.com.mx/developers/en/reference/stores/_users_user_id_stores/post
 */

import { mpFetch } from "./mpFetch";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpStore {
  id: string;
  name: string;
  external_id?: string;
  date_creation: string;
  location?: {
    street_name?: string;
    street_number?: string;
    city_name?: string;
    state_name?: string;
    latitude?: number;
    longitude?: number;
    reference?: string;
  };
  business_hours?: {
    monday?: Array<{ open: string; close: string }>;
    tuesday?: Array<{ open: string; close: string }>;
    wednesday?: Array<{ open: string; close: string }>;
    thursday?: Array<{ open: string; close: string }>;
    friday?: Array<{ open: string; close: string }>;
    saturday?: Array<{ open: string; close: string }>;
    sunday?: Array<{ open: string; close: string }>;
  };
}

export interface CreateStoreParams {
  accessToken: string;
  mpUserId: string;
  name: string;
  externalId: string;
  location?: {
    streetName?: string;
    streetNumber?: string;
    cityName?: string;
    stateName?: string;
    latitude?: number;
    longitude?: number;
    reference?: string;
  };
}

export interface UpdateStoreParams {
  accessToken: string;
  mpUserId: string;
  storeId: string;
  name?: string;
  externalId?: string;
  location?: CreateStoreParams["location"];
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Creates a new store (branch/sucursal) for the MP user.
 * Endpoint: POST /users/{user_id}/stores
 */
export async function createStore({
  accessToken,
  mpUserId,
  name,
  externalId,
  location,
}: CreateStoreParams): Promise<MpStore> {
  const body: Record<string, unknown> = {
    name,
    external_id: externalId,
  };

  if (location) {
    body.location = {
      street_name: location.streetName,
      street_number: location.streetNumber,
      city_name: location.cityName,
      state_name: location.stateName,
      latitude: location.latitude,
      longitude: location.longitude,
      reference: location.reference,
    };
  }

  return mpFetch<MpStore>({
    accessToken,
    method: "POST",
    path: `/users/${mpUserId}/stores`,
    body,
  });
}

/**
 * Lists all stores for the MP user.
 * Endpoint: GET /users/{user_id}/stores
 */
export async function listStores({
  accessToken,
  mpUserId,
}: {
  accessToken: string;
  mpUserId: string;
}): Promise<MpStore[]> {
  const data = await mpFetch<{ results?: MpStore[]; paging?: unknown }>({
    accessToken,
    path: `/users/${mpUserId}/stores`,
  });
  return data.results ?? [];
}

/**
 * Updates an existing store.
 * Endpoint: PUT /users/{user_id}/stores/{store_id}
 */
export async function updateStore({
  accessToken,
  mpUserId,
  storeId,
  name,
  externalId,
  location,
}: UpdateStoreParams): Promise<MpStore> {
  const body: Record<string, unknown> = {};
  if (name !== undefined) body.name = name;
  if (externalId !== undefined) body.external_id = externalId;
  if (location) {
    body.location = {
      street_name: location.streetName,
      street_number: location.streetNumber,
      city_name: location.cityName,
      state_name: location.stateName,
      latitude: location.latitude,
      longitude: location.longitude,
      reference: location.reference,
    };
  }

  return mpFetch<MpStore>({
    accessToken,
    method: "PUT",
    path: `/users/${mpUserId}/stores/${storeId}`,
    body,
  });
}

/**
 * Deletes a store.
 * Endpoint: DELETE /users/{user_id}/stores/{store_id}
 */
export async function deleteStore({
  accessToken,
  mpUserId,
  storeId,
}: {
  accessToken: string;
  mpUserId: string;
  storeId: string;
}): Promise<void> {
  await mpFetch<unknown>({
    accessToken,
    method: "DELETE",
    path: `/users/${mpUserId}/stores/${storeId}`,
  });
}
