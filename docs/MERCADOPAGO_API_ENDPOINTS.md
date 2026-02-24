# Mercado Pago — API Endpoint Analysis

> Issue #24 context enrichment. Cross-references our codebase against the
> official Mercado Pago API Reference (June 2025).

---

## Prerequisites — MP Application Must Be Created

Before **any** endpoint works, the Mercado Pago Application must be properly
configured in the developer dashboard:

| Step | Dashboard action | Why |
|------|-----------------|-----|
| 1 | Create Application at <https://www.mercadopago.com.mx/developers/panel/app> | Generates `client_id` / `client_secret` |
| 2 | Fill **all** required fields (name, description, logo, category) | Incomplete apps return "not finished yet" errors |
| 3 | Set **Redirect URI** to match `MP_REDIRECT_URI` env var exactly | OAuth callback will fail otherwise |
| 4 | Enable OAuth scopes: `read`, `write`, `offline_access` | Token exchange needs these |
| 5 | Configure **Webhook URL** → `https://<domain>/api/mercadopago/webhook` | MP won't deliver notifications without this |
| 6 | Set webhook events: `payment`, `point_integration_wh`, `mp-connect` | Only subscribed events arrive |
| 7 | For production: activate production credentials | Sandbox creds won't process real payments |

---

## 1. Outbound Calls (Our App → MP API)

### 1.1 OAuth Authorization Redirect

| Field | Value |
|-------|-------|
| **Service** | `oauthService.ts` → `getAuthorizeUrl()` |
| **Method** | `GET` (browser redirect, not server fetch) |
| **URL** | `{MP_AUTH_BASE_URL}/authorization` |
| **Default base** | `https://auth.mercadopago.com.mx` |
| **Params** | `client_id`, `response_type=code`, `platform_id=mp`, `redirect_uri`, `state` |
| **Official ref** | <https://www.mercadopago.com.mx/developers/en/docs/security/oauth> |
| **Status** | ✅ Correct |

---

### 1.2 OAuth Token Exchange

| Field | Value |
|-------|-------|
| **Service** | `oauthService.ts` → `exchangeCodeForToken()` |
| **Method** | `POST` |
| **URL** | `{MP_API_BASE_URL}/oauth/token` |
| **Default base** | `https://api.mercadopago.com.mx` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Body** | `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri` |
| **Official ref** | `POST https://api.mercadopago.com/oauth/token` |
| **Official body** | Same fields + optional `code_verifier` (PKCE), `test_token` |
| **Response** | `{ access_token, token_type, expires_in, scope, user_id, refresh_token, public_key, live_mode }` |
| **Status** | ⚠️ See notes |

**Notes:**
- Official canonical base is `api.mercadopago.com` (no `.mx`). The `.mx` domain
  may work via redirect but isn't documented.
- `expires_in` = 15552000 (180 days). We store `access_token` but do not persist
  `refresh_token` — see §1.8.

---

### 1.3 Get User Info

| Field | Value |
|-------|-------|
| **Service** | `oauthService.ts` → `getUserInfo()` |
| **Method** | `GET` |
| **URL** | `{MP_API_BASE_URL}/users/me` |
| **Auth** | `Bearer {access_token}` |
| **Response** | `{ id, nickname, email, first_name, last_name }` |
| **Status** | ✅ Correct |

---

### 1.4 List Terminals

| Field | Value |
|-------|-------|
| **Service** | `paymentService.ts` → `listTerminals()` |
| **Method** | `GET` |
| **URL** | `https://api.mercadopago.com/terminals/v1/list` |
| **Auth** | `Bearer {access_token}` |
| **Official ref** | `GET https://api.mercadopago.com/terminals/v1/list` |
| **Official response** | `{ data: { terminals: [ { id, pos_id, store_id, external_pos_id, operating_mode } ] }, paging }` |
| **Our code expects** | `data.terminals[]` (with `devices[]` fallback for compatibility) |
| **Status** | ✅ **Fixed** — response schema updated to match official API |

**Fix applied (this session):** `listTerminals()` now reads `data.data.terminals[]` with
a fallback to `data.devices[]` for backward compatibility. `MpTerminal` interface updated
to include `store_id`, `external_pos_id`.

---

### 1.5 Create QR Payment (Dynamic QR)

| Field | Value |
|-------|-------|
| **Service** | `paymentService.ts` → `createQRPayment()` |
| **Method** | `POST` |
| **URL** | `https://api.mercadopago.com/instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs` |
| **Auth** | `Bearer {access_token}` |
| **Body** | `{ external_reference, title, description, total_amount, items[], cash_out }` |
| **Official ref** | Instore QR dynamic orders (reference page returned error; path confirmed from legacy docs) |
| **Status** | ⚠️ See notes |

**Notes:**
1. Our code hardcodes `external_pos_id = "orders_pdv"`. This POS must be
   **pre-registered** via the Stores/POS API (`POST /pos`) or the call returns
   404. Currently we do not create POS records.
2. `total_amount` is sent as `amountCents / 100` (float) — correct per MP docs
   (they expect amount in units, e.g., 10.50).
3. The QR dynamic endpoint path uses `/qrs` suffix which differs from the
   documented `/orders` PUT variant. Need to verify this works for Mexico.

---

### 1.6 Create PDV Payment Intent (LEGACY API)

| Field | Value |
|-------|-------|
| **Service** | `paymentService.ts` → `createPDVPaymentIntent()` |
| **Method** | `POST` |
| **URL** | `https://api.mercadopago.com/point/integration-api/devices/{device_id}/payment-intents` |
| **Auth** | `Bearer {access_token}` |
| **Our body** | `{ amount, description, payment: { type: "debit_card" }, additional_info: { external_reference, print_on_terminal } }` |
| **Official ref (Legacy)** | `POST https://api.mercadopago.com/point/integration-api/devices/{deviceid}/payment-intents` |
| **Official body** | `{ amount, additional_info: { external_reference, print_on_terminal } }` |
| **Status** | ⚠️ Legacy + schema differences |

**Status of known issues:**
1. **This is the LEGACY Payment Intent API.** MP now recommends the new
   **Orders API** (`POST /v1/orders` with `type: "point"`). The legacy API is
   listed under "POINT (LEGACY)" in the reference. See `MERCADOPAGO_PDV_MIGRATION.md`
   for the full migration analysis and decision record.
2. ✅ **Fixed (this session):** `payment.type: "debit_card"` field removed from body.
   Official legacy docs only accept `amount` + `additional_info`.
3. ✅ **Fixed (this session):** Amount now sent as integer cents (`amountCents`).
   Old code divided by 100 producing a float — legacy API requires integer (e.g. `1500` = $15.00 MXN).
4. ⚠️ Sandbox testing requires `x-test-scope: sandbox` header — not yet sent.

**New API equivalent:**
```
POST https://api.mercadopago.com/v1/orders
Headers: Authorization: Bearer {token}, X-Idempotency-Key: {uuid}
Body: {
  "type": "point",
  "external_reference": "{orderId}",
  "transactions": { "payments": [{ "amount": "15.00" }] },
  "config": {
    "point": { "terminal_id": "{device_id}", "print_on_terminal": "no_ticket" },
    "payment_method": { "default_type": "credit_card" }
  },
  "description": "Orden"
}
```

---

### 1.7 Fetch Payment Details

| Field | Value |
|-------|-------|
| **Service** | `webhookService.ts` → `fetchPaymentDetails()` |
| **Method** | `GET` |
| **URL** | `https://api.mercadopago.com/v1/payments/{paymentId}` |
| **Auth** | `Bearer {access_token}` |
| **Official ref** | `GET https://api.mercadopago.com/v1/payments/{id}` |
| **Response** | Full payment object with `status`, `external_reference`, `transaction_amount`, etc. |
| **Status** | ✅ Correct |

---

### 1.8 Refresh Token

| Field | Value |
|-------|-------|
| **Service** | `oauthService.ts` → `refreshAccessToken()` |
| **Method** | `POST` |
| **URL** | `https://api.mercadopago.com/oauth/token` |
| **Body** | `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token` |
| **Official ref** | Same endpoint as §1.2 with different `grant_type` |
| **Auto-refresh** | `credentialsService.ts` → `refreshCredentialsIfNeeded()` triggers refresh 60 s before expiry |
| **Persistence** | Updated `access_token`, `refresh_token`, `token_expires_at`, `refreshed_at` written back to DB |
| **Status** | ✅ **Implemented (this session)** — see `MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md` |

---

## 2. Inbound Endpoints (MP → Our App)

### 2.1 OAuth Callback

| Field | Value |
|-------|-------|
| **Route** | `GET /api/mercadopago/webhook` (primary) |
| **Legacy route** | `GET /api/mercadopago/oauth/callback` (backward compat) |
| **Handler** | `oauthCallbackHandler.ts` → `handleOAuthCallback()` |
| **Query params from MP** | `code`, `state`, `error`, `error_description` |
| **Cookies set** | `mp_oauth_state`, `mp_oauth_tenant`, `mp_oauth_email` (10 min TTL) |
| **Status** | ✅ **Fixed** — `mp_oauth_email` cookie is set in the authorize route |

**Fix verified (this session):** The authorize route (`/api/mercadopago/oauth/authorize`)
correctly sets all three cookies: `mp_oauth_state`, `mp_oauth_tenant`, and `mp_oauth_email`.
The callback handler reads all three and proceeds normally.

---

### 2.2 Production Webhook

| Field | Value |
|-------|-------|
| **Route** | `POST /api/mercadopago/webhook` |
| **Handler** | `webhookService.processWebhook()` |
| **HMAC validation** | `x-signature` header via HMAC-SHA256 (when `MP_WEBHOOK_SECRET` is set) |
| **Handled event types** | `payment`, `point_integration_wh`, `mp-connect` |
| **Signature manifest** | `id:{data.id};request-id:{x-request-id};ts:{ts};` |
| **Always returns 200** | Prevents MP retry storms (MP retries non-2xx every 15min for 3 days) |
| **Status** | ✅ Correct |

---

### 2.3 Test/Sandbox Webhook

| Field | Value |
|-------|-------|
| **Route** | `POST /api/mercadopago/webhook/test` |
| **Handler** | Same `processWebhook()`, no signature validation |
| **Env var** | Requires `MP_REDIRECT_TEST_URI` |
| **Status** | ✅ Correct for development |

---

### 2.4 OAuth Initiation

| Field | Value |
|-------|-------|
| **Route** | `GET /api/mercadopago/oauth/authorize` |
| **Handler** | Validates session, generates state, redirects to MP |
| **Cookies set** | `mp_oauth_state`, `mp_oauth_tenant`, `mp_oauth_email` (10 min TTL) |
| **Status** | ✅ **Fixed** — all three cookies set; see §2.1 |

---

## 3. Summary of Issues Found

### Critical (all resolved)

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| C1 | `listTerminals()` schema mismatch (`devices` vs `data.terminals`) | ✅ Fixed | Reads `data.terminals[]` with `devices[]` fallback |
| C2 | `mp_oauth_email` cookie never set in authorize route | ✅ Fixed | Cookie was already present; verified in code audit |
| C3 | PDV sends float amount instead of integer cents | ✅ Fixed | Now sends `amountCents` directly as integer |

### High (partially resolved)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| H1 | No `refresh_token` exchange | ✅ Fixed | Auto-refresh implemented; see §1.8 + `MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md` |
| H2 | Using LEGACY Point Payment Intent API | ⚠️ Open | Decision deferred; see `MERCADOPAGO_PDV_MIGRATION.md` |
| H3 | QR flow requires pre-registered POS (`orders_pdv`) | ⚠️ Open | POS must be created in MP dashboard before first use |
| H4 | Legacy PDV body includes undocumented `payment.type` field | ✅ Fixed | `payment.type` field removed from request body |
| H5 | Missing `x-test-scope: sandbox` header for test mode | ⚠️ Open | Add when sandbox testing is active |

### Medium (partially resolved)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| M1 | Three different base URL patterns | ⚠️ Open | Consolidation recommended but not blocking |
| M2 | `MpTerminal` interface missing fields | ✅ Fixed | `store_id`, `external_pos_id` added |
| M3 | `credentialsService` does not store `refresh_token` | ✅ Fixed | DB schema v12 adds `refresh_token`, `token_expires_at`, `refreshed_at` |
| M4 | New Orders API requires `X-Idempotency-Key` | ⚠️ Open | Will add when migrating to new Point API |

---

## 4. Base URL Consolidation

| Service | Current base | Configurable? | Official |
|---------|-------------|--------------|----------|
| `oauthService.ts` (auth) | `https://auth.mercadopago.com.mx` | ✅ via `MP_AUTH_BASE_URL` | `https://auth.mercadopago.com.mx` (country-specific, correct) |
| `oauthService.ts` (api) | `https://api.mercadopago.com.mx` | ✅ via `MP_API_BASE_URL` | `https://api.mercadopago.com` |
| `paymentService.ts` | `https://api.mercadopago.com` | ❌ hardcoded | `https://api.mercadopago.com` ✅ |
| `webhookService.ts` | `https://api.mercadopago.com` | ❌ hardcoded | `https://api.mercadopago.com` ✅ |

**Recommendation:** Consolidate to a single `MP_API_BASE_URL` env var defaulting
to `https://api.mercadopago.com`. The auth base (`auth.mercadopago.com.mx`) is
correctly country-specific and should stay separate.

---

## 5. Environment Variables Required

| Variable | Service | Required | Purpose |
|----------|---------|----------|---------|
| `MP_CLIENT_ID` | oauthService | ✅ | OAuth app client ID |
| `MP_CLIENT_SECRET` | oauthService | ✅ | OAuth app client secret |
| `MP_REDIRECT_URI` | oauthService | ✅ | OAuth callback URL (relative or absolute) |
| `MP_AUTH_BASE_URL` | oauthService | Optional | Country-specific auth domain |
| `MP_API_BASE_URL` | oauthService | Optional | API domain (should default to `api.mercadopago.com`) |
| `MP_WEBHOOK_SECRET` | webhook route | Recommended | HMAC signature validation |
| `MP_REDIRECT_TEST_URI` | webhook test | Dev only | Test webhook routing |
| `AUTH_COOKIE_NAME` | authorize route | Optional | Session cookie name (default: `__session`) |
| `MP_TOKENS_ENCRYPTION_KEY` | credentialsService / tokenCrypto | Recommended | AES-256-GCM key for token encryption at rest. Falls back to `AUTH_SECRET` if unset. Generate with: `openssl rand -hex 32` |
| `VERCEL_URL` | oauthService | Auto | Used for redirect URI resolution |

---

## 6. Recommended Migration Path (Legacy → New Point API)

The new Point Orders API (`POST /v1/orders`) supersedes the legacy Payment Intent
API. Migration steps:

1. **Update `createPDVPaymentIntent()`** to call `POST /v1/orders` instead of
   `POST /point/integration-api/devices/{device_id}/payment-intents`
2. **Add `X-Idempotency-Key` header** (UUID per request)
3. **Update request body** to new schema:
   ```json
   {
     "type": "point",
     "external_reference": "{orderId}",
     "transactions": { "payments": [{ "amount": "15.00" }] },
     "config": {
       "point": { "terminal_id": "{device_id}" },
       "payment_method": { "default_type": "credit_card" }
     }
   }
   ```
4. **Update `listTerminals()` response parsing** — both APIs use the same
   terminals endpoint
5. **Update webhook handler** — new API sends order-level webhooks; may need to
   handle `type: "order"` or similar
6. **Update `MpPDVPaymentIntentResult` type** to match new order response shape

---

## 7. API Reference Links

| Endpoint | Official Reference |
|----------|--------------------|
| OAuth token | <https://www.mercadopago.com.mx/developers/en/reference/oauth/_oauth_token/post> |
| Get payment | <https://www.mercadopago.com.mx/developers/en/reference/payments/_payments_id/get> |
| List terminals | <https://www.mercadopago.com.mx/developers/en/reference/in-person-payments/point/terminals/get-terminals/get> |
| Create order (new Point) | <https://www.mercadopago.com.mx/developers/en/reference/in-person-payments/point/orders/create-order/post> |
| Create payment intent (legacy) | <https://www.mercadopago.com.mx/developers/en/reference/point_apis_mlm/_point_integration-api_devices_deviceid_payment-intents/post> |
| Get devices (legacy) | <https://www.mercadopago.com.mx/developers/en/reference/integrations_api/_point_integration-api_devices/get> |
| Webhook docs | <https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks> |
| OAuth docs | <https://www.mercadopago.com.mx/developers/en/docs/security/oauth> |
