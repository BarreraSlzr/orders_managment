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

/** Default timeout for all MP API calls (20s — MP expects response within 22s). */
const MP_FETCH_TIMEOUT_MS = 20_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MpTerminal {
  id: string;
  name?: string;
  operating_mode: string;
  pos_id?: number;
  store_id?: string;
  external_pos_id?: string;
}

export interface MpQRPaymentResult {
  qr_data: string;
  in_store_order_id: string;
}

/** @deprecated Legacy Point API shape — use MpOrderResult for new v1/orders responses */
export interface MpPDVPaymentIntentResult {
  id: string;
  state: string;
  device_id: string;
  amount: number;
}

/** MP Orders API v1 response shape (PDV flow, new endpoint) */
export interface MpOrderResult {
  id: string;
  status: "open" | "closed" | "expired";
  external_reference: string;
  transactions: {
    payments: Array<{ id: string; amount: string; status: string }>;
  };
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function mpFetch<T>(params: {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  /** Additional headers merged on top of Authorization + Content-Type */
  extraHeaders?: Record<string, string>;
}): Promise<T> {
  const { accessToken, method = "GET", path, body, extraHeaders } = params;

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MP_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${MP_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
  const data = await mpFetch<{
    data?: { terminals?: MpTerminal[] };
    devices?: MpTerminal[];
  }>({
    accessToken,
    path: "/terminals/v1/list",
  });
  return data.data?.terminals ?? data.devices ?? [];
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
 * Endpoint: POST /v1/orders  (MP Orders API — replaces legacy PDV endpoint)
 *
 * Changes from legacy:
 *  - Amount is a decimal string ("15.00"), not integer cents
 *  - Body nests payments inside transactions[]
 *  - terminal_id goes inside config.point
 *  - X-Idempotency-Key header required per call
 */
export async function createPDVPaymentIntent({
  accessToken,
  deviceId,
  amountCents,
  externalReference,
  description = "Orden",
}: CreatePDVPaymentIntentParams): Promise<MpOrderResult> {
  const body = {
    type: "point",
    external_reference: externalReference,
    description,
    transactions: {
      payments: [
        {
          amount: (amountCents / 100).toFixed(2),
        },
      ],
    },
    config: {
      point: {
        terminal_id: deviceId,
        print_on_terminal: "full_ticket",
      },
      payment_method: {
        default_type: "any",
      },
    },
  };

  return mpFetch<MpOrderResult>({
    accessToken,
    method: "POST",
    path: "/v1/orders",
    body,
    extraHeaders: {
      "X-Idempotency-Key": crypto.randomUUID(),
    },
  });
}

// ─── PDV cancel intent ─────────────────────────────────────────────────────────

export interface CancelPDVPaymentIntentParams {
  accessToken: string;
  /** Terminal device_id */
  deviceId: string;
  /** Payment intent id (mp_transaction_id) */
  intentId: string;
}

/**
 * Cancels a payment intent on the Point terminal.
 * Endpoint: DELETE /v1/orders/{orderId}  (MP Orders API)
 *
 * Note: the new Orders API no longer uses device_id in the cancel path.
 * The deviceId parameter is kept in the interface for backward compatibility
 * but is not sent to the API.
 *
 * Best-effort: swallows errors if the intent was already finished or does not
 * exist on the MP side.  The DB row is still marked canceled by the caller.
 */
export async function cancelPDVPaymentIntent({
  accessToken,
  // deviceId kept for API compatibility — not used by new Orders API cancel endpoint
  intentId,
}: CancelPDVPaymentIntentParams): Promise<void> {
  try {
    await mpFetch<unknown>({
      accessToken,
      method: "DELETE",
      path: `/v1/orders/${intentId}`,
    });
  } catch (error) {
    // Best-effort — the intent may already be finished / expired.
    console.warn(
      `[mp-pdv] cancelPDVPaymentIntent best-effort failure for intent ${intentId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
