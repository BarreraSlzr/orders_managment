# Mercado Pago Platform + Tenant Architecture

See also:

- [MercadoPago OAuth Integration](./MERCADOPAGO_OAUTH.md)
- [MercadoPago Integration — Visual Diagrams](./MERCADOPAGO_DIAGRAMS.md)
- [API Endpoint Analysis](./MERCADOPAGO_API_ENDPOINTS.md)
- [Token Lifecycle Runbook](./MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md)
- [Webhook Observability Runbook](./MERCADOPAGO_WEBHOOK_OBSERVABILITY_RUNBOOK.md)
- [Entitlement Architecture](./MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md)
- [PDV Migration Analysis](./MERCADOPAGO_PDV_MIGRATION.md)

## Scope Decisions (confirmed)

- Tenant access gate: **Soft gate**.
  - Tenant can access the app generally.
  - Mercado Pago operational features are blocked when subscription is inactive.
- Mercado Pago accounts per tenant: **Single active account** (MVP).
- In-person payment modes for tenant customers: **Both QR + PDV terminal**.
- Documentation retrieval for Mercado Pago docs: prefer URL ending in `.md`, fallback to HTML when unavailable.

## Product Boundaries

## A) Platform billing access (Tenant → Our Platform)

**Purpose**: control whether tenant can use paid features.

- Payer: tenant (business owner) pays our platform subscription.
- Merchant of record: our own company account.
- Recommended integration: Mercado Pago **Subscriptions/Recurring** (separate app/account from tenant payment processing if possible).
- Output in our system: tenant entitlement state (`active`, `past_due`, `canceled`, `grace_period`).

## B) Tenant payment processing (Tenant → Their Customer)

**Purpose**: allow tenant to collect in-person payments from their customers.

- Payer: final customer of tenant.
- Merchant of record: tenant’s own Mercado Pago account.
- Integration mode: tenant connects via OAuth and receives per-tenant credentials.
- Runtime payment flows: `qr` and `pdv`.

---

These two flows **must stay decoupled** at data, credentials, and webhook routing level.

## Current Implementation Map (what already exists)

### Existing API routes

- `GET /api/mercadopago/oauth/authorize`
- `GET /api/mercadopago/webhook` (OAuth callback)
- `GET /api/mercadopago/oauth/callback` (legacy alias)
- `POST /api/mercadopago/webhook` (production webhook)
- `POST /api/mercadopago/webhook/test` (sandbox webhook)

### Existing tenant credentials and sync tables

- `mercadopago_credentials`
- `mercadopago_access_requests`
- `payment_sync_attempts`

### Existing in-person processing support

- QR and PDV API helper methods in service layer.
- Payment status reconciliation through webhook (`payment`, `point_integration_wh`, `mp-connect`).

### Current technical gaps

- Platform subscription entitlement model is not yet implemented as first-class domain.
  See [MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md](./MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md).
- Disconnect UX may not fully deactivate server-side credentials in all paths.
- Platform billing webhook route not yet implemented.

### Completed in this branch

- ✅ Access token and refresh token encrypted at rest (AES-256-GCM, `enc:v1:` format).
- ✅ Refresh token lifecycle implemented with proactive auto-renewal 60 s before expiry.
- ✅ Opportunistic re-encryption of legacy plaintext rows.
- ✅ DB schema extended (migration v12): `refresh_token`, `token_expires_at`, `refreshed_at`.
- ✅ Critical API bugs fixed: terminal schema, PDV amount format, OAuth email cookie.

## Target Architecture

## 1) Entitlements domain (new)

Create explicit platform billing domain (separate from tenant customer payments):

- `tenant_subscriptions` (tenant_id, provider, external_subscription_id, status, current_period_end, canceled_at, metadata)
- `tenant_entitlements` (tenant_id, subscription_status, features_enabled, updated_at)
- Optional `tenant_billing_events` for audit/debug.

### Access policy (Soft gate)

- Base app access remains available.
- Mercado Pago operational actions are denied when entitlement is inactive:
  - OAuth connect/reconnect
  - Start QR/PDV payment
  - Payment retry/cancel actions

## 2) Tenant Mercado Pago credentials domain (existing + hardening)

Keep one active credential row per tenant (MVP).

Required hardening:

- Encrypt `access_token` and `refresh_token` at rest.
- Add refresh-token management with proactive renewal.
- Add stronger uniqueness/guardrails for active credential ownership.
- Make disconnect explicit server-side deactivation and audit.

## 3) Webhook segregation

Keep webhooks logically separated:

- **Platform billing webhook** (our subscription account)
  - updates `tenant_subscriptions` + `tenant_entitlements`
- **Tenant processing webhook** (tenant OAuth account events)
  - updates `payment_sync_attempts` and credential status

If shared endpoint is kept for MVP, route by clear event type/provider context and store source metadata.

## Core Flows

## Flow A: Tenant subscription to unlock MP features

1. Tenant starts platform subscription checkout.
2. Provider confirms subscription (sync callback + webhook confirmation).
3. System updates `tenant_subscriptions` and computes entitlement.
4. UI and API now allow Mercado Pago operations for this tenant.

Failure behavior:

- If payment fails/expired: entitlement becomes inactive (or grace period), MP operational actions blocked.

## Flow B: Tenant OAuth connect

1. Manager requests access and clicks connect.
2. `/api/mercadopago/oauth/authorize` validates session + entitlement.
3. OAuth callback exchanges code for token and stores tenant-scoped credentials.
4. Access request is marked completed and audit event is emitted.

Failure behavior:

- Invalid state/redirect mismatch/token exchange failure => deterministic status back to UI and actionable message.

## Flow C: QR/PDV payment for tenant customer

1. Manager starts payment (`flow: qr | pdv`) for closed order.
2. Entitlement + credentials preconditions validated.
3. Sync attempt created and moved to processing.
4. QR generated or PDV intent sent.
5. Webhook reconciles final status and updates `payment_sync_attempts`.
6. UI polls status endpoint until terminal state.

## Infrastructure Requirements Checklist

## Mercado Pago app configuration

- OAuth redirect URIs:
  - local and production URLs registered exactly.
- Webhook URL(s):
  - production endpoint configured.
  - test endpoint configured when needed.
- App status in Mercado Pago developer panel:
  - ensure app is fully configured/approved for intended scope and environment.

## Environment and secrets

- Required now:
  - `MP_CLIENT_ID`
  - `MP_CLIENT_SECRET`
  - `MP_REDIRECT_URI`
  - `MP_REDIRECT_TEST_URI`
  - `MP_WEBHOOK_SECRET`
- Required next:
  - encryption key for MP credential encryption.
  - optional secrets for subscription provider flow if separated.

## Operational controls

- Webhook signature validation enabled in production.
- Structured logging with tenant_id, notification type, and correlation IDs.
- Replay-safe webhook handling (idempotency).
- Alerting for repeated webhook errors and token refresh failures.

## Endpoint Strategy: Current vs Recommended

## Keep (already correct)

- `/api/mercadopago/oauth/authorize`
- `/api/mercadopago/webhook` (GET callback + POST notifications)
- `/api/mercadopago/webhook/test`

## Add (recommended)

- `/api/billing/mercadopago/webhook` for platform subscription lifecycle.
- Optional service-level separation between:
  - `mercadopago/platform-billing/*`
  - `mercadopago/tenant-payments/*`

## Deprecate carefully

- `/api/mercadopago/oauth/callback` alias can remain temporary but should be documented as compatibility-only.

## Security Requirements

- Never expose `access_token` in UI or API responses.
- Encrypt stored credentials at rest.
- Rotate refresh/access tokens via background job.
- Enforce tenant_id checks at query boundaries.
- Audit connect/disconnect/reconnect and credential errors.

## Delivery Plan (phased)

## Phase 1 (stabilize current flow)

- Add entitlement preconditions around MP operations.
- Harden OAuth validation and user-facing error states.
- Ensure production app settings are complete in Mercado Pago panel.
- Verify webhook signatures and idempotency behavior.

## Phase 2 (subscription domain)

- Implement `tenant_subscriptions` + `tenant_entitlements`.
- Add billing webhook and status transitions.
- Wire soft-gate checks in UI + API middleware/procedures.

## Phase 3 (credentials hardening)

- Encrypt token fields.
- Add refresh-token lifecycle and retry policy.
- Complete server-side disconnect semantics.

## Phase 4 (operational maturity)

- Metrics and alerting dashboard.
- Reconciliation tools for stuck attempts.
- Runbooks for OAuth failures, webhook drift, and provider outages.

## Go-Live Readiness

A tenant should be considered production-ready only when all are true:

- Subscription entitlement is active.
- OAuth credentials are connected and healthy.
- At least one PDV or QR flow has passed end-to-end test in target environment.
- Webhook notifications are received, validated, and reflected in `payment_sync_attempts`.
- Support runbook exists for failures.

## Mercado Pago Documentation Retrieval Rule

For external Mercado Pago docs used by this project, default to `.md` URLs:

- Example: `https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/overview.md`

Fallback to HTML URL only if the specific `.md` path is not available.
