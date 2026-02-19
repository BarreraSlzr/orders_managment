# MercadoPago OAuth Integration

This document explains how to set up and use the MercadoPago OAuth integration for simplified credential management.

## Overview

Tenants connect their MercadoPago account exclusively through the **OAuth 2.0 authorization flow**.  No manual credential entry is needed — the system obtains and stores `access_token`, `user_id`, and `app_id` automatically during the OAuth callback.

## OAuth Setup

### 1. Create a MercadoPago Application

1. Go to [MercadoPago Developer Dashboard](https://www.mercadopago.com.mx/developers/panel/app)
2. Create a new application or select an existing one
3. Configure the OAuth settings:
   - **Redirect URI**: Set to your application's callback URL
     - Local: `http://localhost:3000/api/mercadopago/oauth/callback`
     - Production: `https://yourdomain.com/api/mercadopago/oauth/callback`
4. Note your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# MercadoPago OAuth
MP_CLIENT_ID=your_client_id_here
MP_CLIENT_SECRET=your_client_secret_here
MP_REDIRECT_OAUTH_URI=/api/mercadopago/oauth/callback

# MercadoPago Webhooks (register these URLs in the MP dashboard)
MP_REDIRECT_PAYMENTS_EVENTS_URI=/api/mercadopago/webhook
MP_REDIRECT_PAYMENTS_EVENTS_TEST_URI=/api/mercadopago/webhook/test
MP_WEBHOOK_SECRET=your_webhook_secret_here
```

> The `MP_REDIRECT_OAUTH_URI` is a relative path.  At runtime the app
> resolves it to a full URL using the request origin (or `VERCEL_URL`).

### 3. Restart Your Development Server

```bash
bun run dev
```

## User Flow

### With OAuth (Simplified)

1. User opens Admin Settings → Mercado Pago tab
2. Clicks "Conectar con Mercado Pago" button (MP-branded)
3. Redirects to MercadoPago authorization page
4. User authorizes the application
5. Redirects back to app with credentials automatically saved
6. Toast notification confirms connection success



## Security Features

- **CSRF Protection**: State parameter validates OAuth callback authenticity
- **Session Validation**: Only authenticated users can initiate OAuth
- **Secure Cookies**: OAuth state and tenant context stored in httpOnly cookies
- **Token Encryption**: Access tokens should be encrypted at rest (TODO in production)
- **Tenant Isolation**: Credentials are scoped per tenant

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

### `GET /api/mercadopago/oauth/callback`

**Purpose**: Handles OAuth callback — exchanges code for token and stores credentials.

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
4. Update MercadoPago app redirect URI to: `https://abc123.ngrok.io/api/mercadopago/oauth/callback`
5. The `MP_REDIRECT_OAUTH_URI=/api/mercadopago/oauth/callback` path
   resolves automatically against the ngrok origin at runtime.
6. Restart dev server and test OAuth flow

## Troubleshooting

### "OAuth not configured"

- Verify `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, and `MP_REDIRECT_OAUTH_URI` are set in `.env.local`
- Restart dev server after adding env vars
- Check browser console for errors

### Redirect URI Mismatch Error

- Ensure redirect URI in MercadoPago dashboard matches the resolved `MP_REDIRECT_OAUTH_URI` exactly
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

## Future Enhancements

- [ ] Refresh token support for long-lived sessions
- [ ] Token encryption at rest
- [ ] Multi-account MercadoPago support per tenant
- [ ] OAuth scope management for permission control
- [x] Webhook endpoints for payment/point/mp-connect events
- [ ] Webhook setup automation during OAuth
