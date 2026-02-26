/**
 * mpFetch — shared HTTP helper for all Mercado Pago API calls.
 *
 * Centralizes:
 *  - Bearer token authentication
 *  - Timeout handling (20s default, MP expects response within 22s)
 *  - Integrator ID / Platform ID headers (B4 quality checklist)
 *  - Error normalization
 *
 * Extracted from paymentService to be reusable across store, POS,
 * refund, and device management services.
 */

const MP_BASE_URL = "https://api.mercadopago.com";

/** Default timeout for all MP API calls (20s — MP expects response within 22s). */
const MP_FETCH_TIMEOUT_MS = 20_000;

export interface MpFetchParams {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Additional headers merged on top of Authorization + Content-Type */
  extraHeaders?: Record<string, string>;
}

/**
 * Core fetch helper for all MP API calls.
 *
 * Automatically injects:
 *  - `Authorization: Bearer {accessToken}`
 *  - `Content-Type: application/json`
 *  - `X-Integrator-Id` when `MP_INTEGRATOR_ID` env var is set (B4)
 *  - `X-Platform-Id` when `MP_PLATFORM_ID` env var is set (B4)
 */
export async function mpFetch<T>(params: MpFetchParams): Promise<T> {
  const { accessToken, method = "GET", path, body, extraHeaders } = params;

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // B4: Integrator ID / Platform ID — quality checklist compliance
  const integratorId = process.env.MP_INTEGRATOR_ID;
  const platformId = process.env.MP_PLATFORM_ID;
  if (integratorId) (headers as Record<string, string>)["X-Integrator-Id"] = integratorId;
  if (platformId) (headers as Record<string, string>)["X-Platform-Id"] = platformId;

  // Merge caller-provided extra headers last (highest priority)
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

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
