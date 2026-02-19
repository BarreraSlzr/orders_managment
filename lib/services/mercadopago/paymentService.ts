/**
 * paymentService — Mercado Pago API integration helpers.
 *
 * All calls use the tenant's stored access_token as the Bearer credential.
 * Supports two payment flows:
 *   · QR flow  — generates a scannable QR code for in-store checkout.
 *   · PDV flow — sends a payment intent to a physical Point terminal.
 *
 * References:
 *   https://www.mercadopago.com.mx/developers/es/docs/mp-point/payment-processing
 */

const MP_BASE_URL = "https://api.mercadopago.com";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpTerminal {
  id: string;
  name: string;
  operating_mode: string;
  pos_id?: number;
}

export interface MpQRPaymentResult {
  qr_data: string;
  in_store_order_id: string;
}

export interface MpPDVPaymentIntentResult {
  id: string;
  state: string;
  device_id: string;
  amount: number;
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function mpFetch<T>(params: {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
}): Promise<T> {
  const { accessToken, method = "GET", path, body } = params;

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${MP_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    const message =
      (json as { message?: string; error?: string })?.message ??
      (json as { message?: string; error?: string })?.error ??
      `MP API error ${res.status}`;
    throw new Error(message);
  }

  return json as T;
}

// ─── Terminal list ────────────────────────────────────────────────────────────

/**
 * Returns the list of Point terminals registered for the MP account.
 * Defaults to the first terminal when multiple exist.
 */
export async function listTerminals({
  accessToken,
}: {
  accessToken: string;
}): Promise<MpTerminal[]> {
  const data = await mpFetch<{ devices?: MpTerminal[] }>({
    accessToken,
    path: "/terminals/v1/list",
  });
  return data.devices ?? [];
}

// ─── QR flow ─────────────────────────────────────────────────────────────────

export interface CreateQRPaymentParams {
  accessToken: string;
  /** MP user_id from credentials */
  mpUserId: string;
  /** Unique external reference for the order */
  externalReference: string;
  /** Total in cents (e.g. 1000 = $10.00 MXN) */
  amountCents: number;
  /** Human-readable description on the QR */
  description?: string;
}

/**
 * Creates a dynamic QR payment intent.
 * Returns the QR data string (SVG / base64 / URL) and the MP order ID.
 *
 * Uses the instore dynamic QR v1 endpoint.
 * Endpoint: POST /instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
 */
export async function createQRPayment({
  accessToken,
  mpUserId,
  externalReference,
  amountCents,
  description = "Orden",
}: CreateQRPaymentParams): Promise<MpQRPaymentResult> {
  // external_pos_id is stable per-integration; we use the external reference as pos_id
  const externalPosId = `orders_pdv`;

  const body = {
    external_reference: externalReference,
    title: description,
    description,
    total_amount: amountCents / 100,
    items: [
      {
        sku_number: externalReference,
        category: "marketplace",
        title: description,
        description,
        quantity: 1,
        unit_price: amountCents / 100,
        unit_measure: "unit",
        total_amount: amountCents / 100,
      },
    ],
    cash_out: { amount: 0 },
  };

  return mpFetch<MpQRPaymentResult>({
    accessToken,
    method: "POST",
    path: `/instore/orders/qr/seller/collectors/${mpUserId}/pos/${externalPosId}/qrs`,
    body,
  });
}

// ─── PDV flow (Point terminal) ───────────────────────────────────────────────

export interface CreatePDVPaymentIntentParams {
  accessToken: string;
  /** Terminal device_id (from listTerminals) */
  deviceId: string;
  /** Total in cents */
  amountCents: number;
  /** External order reference for idempotency */
  externalReference: string;
  description?: string;
}

/**
 * Sends a payment intent to a physical Point terminal (PDV mode).
 * Endpoint: POST /point/integration-api/devices/{device_id}/payment-intents
 */
export async function createPDVPaymentIntent({
  accessToken,
  deviceId,
  amountCents,
  externalReference,
  description = "Orden",
}: CreatePDVPaymentIntentParams): Promise<MpPDVPaymentIntentResult> {
  const body = {
    amount: amountCents / 100,
    description,
    payment: {
      type: "debit_card",
    },
    additional_info: {
      external_reference: externalReference,
      print_on_terminal: true,
    },
  };

  return mpFetch<MpPDVPaymentIntentResult>({
    accessToken,
    method: "POST",
    path: `/point/integration-api/devices/${deviceId}/payment-intents`,
    body,
  });
}
