# MercadoPago OAuth Integration

This document explains how to set up and use the MercadoPago OAuth integration for simplified credential management.

See also:

- [Mercado Pago Platform + Tenant Architecture](./MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)
- [MercadoPago Integration — Visual Diagrams](./MERCADOPAGO_DIAGRAMS.md)

## Mercado Pago Docs Retrieval Convention

When consuming Mercado Pago external documentation for AI/automation or copy-paste workflows, use the same docs URL with `.md` appended to the path.

- Default: `https://www.mercadopago.com.br/developers/pt/docs/<topic>.md`
- Fallback: use the HTML page only if a specific `.md` URL is unavailable.

Examples:

- `https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/overview.md`
- `https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications.md`

## Overview

> **Two-App Context**: This document covers the OAuth flow for **App 1 (MP-Point, `2318642168506769`)** — the tenant payment app. OAuth connects individual tenants so they can charge their customers. This is separate from App 2 (Billing, `6186158011206269`) which handles platform subscriptions. See [MERCADOPAGO_DIAGRAMS.md §0](./MERCADOPAGO_DIAGRAMS.md) for the full two-app architecture.

Tenants connect their MercadoPago account exclusively through the **OAuth 2.0 authorization flow**.  No manual credential entry is needed — the system obtains and stores `access_token`, `user_id`, and `app_id` automatically during the OAuth callback.

### What Happens After OAuth Connect

When a tenant completes OAuth, the `mercadopago.credentials.upserted` event fires and automatically:
1. **Creates a Store** via `POST /users/{user_id}/stores` (homologation requirement A1)
2. **Creates a POS** via `POST /pos` with the Store ID (homologation requirement A2)

This auto-provisioning ensures the QR flow has a valid `external_pos_id` registered with MercadoPago. If either API call fails, it is logged as a warning but does **not** block the OAuth success flow.

## OAuth Setup

### 1. Create a MercadoPago Application

1. Go to [MercadoPago Developer Dashboard](https://www.mercadopago.com.mx/developers/panel/app)
2. Create a new application or select an existing one
3. Configure the OAuth settings:
   - **Redirect URI**: Set to your application's callback URL
   - Local: `http://localhost:3000/api/mercadopago/webhook`
   - Production: `https://yourdomain.com/api/mercadopago/webhook`
4. Note your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# MercadoPago OAuth (App 1 — MP-Point)
MP_CLIENT_ID=your_client_id_here
MP_CLIENT_SECRET=your_client_secret_here
MP_REDIRECT_URI=/api/mercadopago/webhook
MP_REDIRECT_TEST_URI=/api/mercadopago/webhook/test

# MercadoPago Webhooks (register these URLs in the MP dashboard)
MP_WEBHOOK_SECRET=your_webhook_secret_here

# Token encryption at rest (AES-256-GCM)
# Generate with: openssl rand -hex 32
# Falls back to AUTH_SECRET when not set.
MP_TOKENS_ENCRYPTION_KEY=your_32_byte_hex_key_here

# Optional — Integrator/Platform ID for good practices (B4 headers)
# Only needed for certified MP partners
MP_INTEGRATOR_ID=your_integrator_id
MP_PLATFORM_ID=your_platform_id

# Billing App (App 2 — Subscriptions) — separate MP application
# MP_BILLING_CLIENT_ID=your_billing_app_id
# MP_BILLING_CLIENT_SECRET=your_billing_app_secret
# MP_BILLING_WEBHOOK_SECRET=your_billing_webhook_secret
# See MERCADOPAGO_APPROACH.md §6 for full billing env vars
```

> Recommended: use the same path (`/api/mercadopago/webhook`) for both
> OAuth callback and production webhook URL in the MercadoPago app.

### 3. Restart Your Development Server

```bash
bun run dev
```

## User Flow

### With OAuth (Simplified)

1. User opens Settings → Mercado Pago section
2. Clicks "Conectar con Mercado Pago" button (MP-branded)
3. Redirects to MercadoPago authorization page
4. User authorizes the application
5. Redirects back to app with credentials automatically saved
6. Toast notification confirms connection success



## Security Features

- **CSRF Protection**: State parameter validates OAuth callback authenticity
- **Session Validation**: Only authenticated users can initiate OAuth
- **Secure Cookies**: OAuth state and tenant context stored in httpOnly cookies (10-minute TTL)
- **Token Encryption at Rest**: `access_token` and `refresh_token` are encrypted with AES-256-GCM using `MP_TOKENS_ENCRYPTION_KEY` (or `AUTH_SECRET` as fallback). Format: `enc:v1:<iv>.<tag>.<ciphertext>` (base64url). Plaintext rows are opportunistically re-encrypted on first read. See `lib/services/mercadopago/tokenCrypto.ts`.
- **Tenant Isolation**: Credentials are scoped per tenant

## Token Lifecycle

MP `access_token` expires after **180 days** (`expires_in: 15552000`).

| Field | Stored in DB | Purpose |
|-------|--------------|---------|
| `access_token` | ✅ encrypted | Used for all MP API calls |
| `refresh_token` | ✅ encrypted | Exchanged for a new token pair |
| `token_expires_at` | ✅ timestamp | Enables proactive refresh detection |
| `refreshed_at` | ✅ timestamp | Audit trail of last refresh |

**Auto-refresh behavior** (`credentialsService.ts` → `refreshCredentialsIfNeeded()`):

1. On every `getCredentials()` call the row's `token_expires_at` is compared to `now()`.
2. If remaining time ≤ **60 seconds** (configurable via `REFRESH_SKEW_MS`), a refresh grant is triggered automatically.
3. The response `access_token`, `refresh_token`, `token_expires_at`, and `refreshed_at` are written back to the DB atomically.
4. If the refresh fails, the credential row is set to `status: "error"` with the error message and the **old token is still returned** so the in-flight request can complete.

See [MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md](./MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md) for operator recovery procedures.

## API Routes

### `GET /api/mercadopago/oauth/authorize`

**Purpose**: Initiates OAuth flow

**Requirements**:
- Valid session cookie
- OAuth environment variables configured

**Flow**:
1. Validates user session
2. Generates secure state parameter
3. Stores state and tenant_id in cookies
4. Redirects to MercadoPago authorization URL

### `GET /api/mercadopago/webhook`

**Purpose**: Handles OAuth callback (unified URL) — exchanges code for token and stores credentials.

### `GET /api/mercadopago/oauth/callback`

**Purpose**: Legacy alias for backward compatibility. Delegates to the same OAuth callback handler.

### `POST /api/mercadopago/webhook`

**Purpose**: Production webhook endpoint for all MercadoPago notifications.
Validates `x-signature` HMAC when `MP_WEBHOOK_SECRET` is set.
Resolves tenant from `user_id` → `mercadopago_credentials.user_id`.

Handled event types:
- `payment` — updates `payment_sync_attempts` status from payment details
- `point_integration_wh` — Point terminal state changes
- `mp-connect` — OAuth lifecycle (deauthorization)

### `POST /api/mercadopago/webhook/test`

**Purpose**: Sandbox webhook endpoint.  Same processing, no signature validation.

**Parameters**:
- `code` (query): Authorization code from MercadoPago
- `state` (query): CSRF protection token
- `error` (query, optional): OAuth error from MercadoPago

**Flow**:
1. Validates state parameter
2. Exchanges code for access token
3. Fetches user info from MercadoPago API
4. Stores credentials in database
5. Dispatches audit event
6. Redirects to app root with status

**Success**: `/?mp_oauth=success`  
**Error**: `/?mp_oauth=error&message=...`

## tRPC Procedures

### `mercadopago.credentials.checkOAuth`

**Type**: Query  
**Auth**: Tenant-level

Returns whether OAuth is configured (environment variables present).

**Response**:
```typescript
{ available: boolean }
```

### `mercadopago.credentials.get`

**Type**: Query  
**Auth**: Tenant-level

Returns current credentials status (never returns access_token).

### `mercadopago.credentials.upsert`

**Type**: Mutation  
**Auth**: Manager-level

Manually saves credentials (fallback method).

## Testing OAuth Locally

### Using ngrok (Recommended for testing)

1. Install ngrok: `brew install ngrok`
2. Start ngrok tunnel:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Update MercadoPago app redirect URI to: `https://abc123.ngrok.io/api/mercadopago/webhook`
5. The `MP_REDIRECT_URI=/api/mercadopago/webhook` path
   resolves automatically against the ngrok origin at runtime.
6. Restart dev server and test OAuth flow

## Troubleshooting

### "OAuth not configured"

- Verify `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, and `MP_REDIRECT_URI` are set in `.env.local`
- Restart dev server after adding env vars
- Check browser console for errors

### Redirect URI Mismatch Error

- Ensure redirect URI in MercadoPago dashboard matches the resolved `MP_REDIRECT_URI` exactly
- Include protocol (`http://` or `https://`)
- No trailing slashes

### State Parameter Invalid Error

- Clear cookies and try again
- Check system time is synchronized (OAuth uses timestamps)
- State cookies expire after 10 minutes

### Connection Works but Payments Fail

- OAuth provides web credentials automatically
- For in-person payments (Point terminals), additional device configuration may be needed
- Check that MP account has Point device registered

## Architecture

```
┌─────────┐                    ┌──────────────┐                    ┌────────────┐
│  User   │────(1) Click───────▶│  /authorize  │────(2) Redirect───▶│ MercadoPago│
│ Browser │                    │   API Route  │                    │   OAuth    │
└─────────┘                    └──────────────┘                    └────────────┘
     ▲                                                                     │
     │                                                                     │
     │        (5) Redirect                                                 │
     │        ?mp_oauth=success                                            │
     │                                                                     │
     └──────────────────────────────────────────────────────────────(3)───┘
                                                           User Authorizes
                                                                     │
                                                                     │
┌──────────────┐                    ┌─────────────┐                 │
│   Database   │◀────(4) Store──────│  /callback  │◀────────────────┘
│ Credentials  │      Credentials──▶│  API Route  │   (code, state)
└──────────────┘                    └─────────────┘
```

## Completed Enhancements

- [x] Webhook endpoints for payment/point/mp-connect events
- [x] Refresh token support for long-lived sessions (auto-refresh 60 s before expiry)
- [x] Token encryption at rest (AES-256-GCM via `tokenCrypto.ts`)
- [x] Auto-provisioning Store + POS on OAuth connect (via `credentials.upserted` event handler)
- [x] Shared `mpFetch()` helper with `X-Integrator-Id` / `X-Platform-Id` headers
- [x] Webhooks configured on MP dashboard for both apps (Point + Billing)

## Planned Enhancements

- [ ] Multi-account MercadoPago support per tenant
- [ ] OAuth scope management for permission control
- [ ] Webhook setup automation during OAuth
- [ ] Entitlement soft-gate guard on `/authorize` route (see `MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md`)
- [ ] Billing subscription checkout UI for tenants
