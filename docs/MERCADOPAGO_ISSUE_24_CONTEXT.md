# Mercado Pago — Issue 24 Context Pack (PR Readiness)

This document consolidates the required knowledge, architecture decisions, infrastructure, and rollout criteria for Issue 24.

It is the source of truth for opening a PR that finalizes:

1. Tenant subscription access control to our platform.
2. Tenant-owned in-person payment processing (PDV terminal + QR) with Mercado Pago.

See also:

- [Mercado Pago Platform + Tenant Architecture](./MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)
- [MercadoPago OAuth Integration](./MERCADOPAGO_OAUTH.md)
- [MercadoPago Integration — Visual Diagrams](./MERCADOPAGO_DIAGRAMS.md)
- [API Endpoint Analysis](./MERCADOPAGO_API_ENDPOINTS.md)
- [Token Lifecycle Runbook](./MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md)
- [Webhook Observability Runbook](./MERCADOPAGO_WEBHOOK_OBSERVABILITY_RUNBOOK.md)
- [Entitlement Architecture](./MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md)
- [PDV Migration Analysis](./MERCADOPAGO_PDV_MIGRATION.md)

## 1) Problem Statement (Issue 24)

We currently have working Mercado Pago endpoints and an operational flow, but we need PR-ready clarity for:

- The **split of concerns** between platform subscription billing and tenant customer payments.
- The **production readiness** requirements in Mercado Pago dashboard/app config.
- The **end-to-end contract** for OAuth, webhooks, PDV intents, and QR payments.

Observed risk:

- OAuth authorization can show app-readiness errors ("app not finished yet") when dashboard/app settings are incomplete or inconsistent with runtime URLs and environment mode.

## 2) Confirmed Scope Decisions

- Access model: **Soft gate**.
  - Tenant keeps general app access.
  - Mercado Pago operational actions are blocked if subscription entitlement is inactive.
- Tenant MP account model: **one active linked account per tenant** (MVP).
- In-person collection modes: **both `pdv` and `qr`**.
- External docs retrieval policy: **prefer Mercado Pago docs path ending in `.md`**; fallback to HTML only when unavailable.

## 3) Current Implemented Surface (already in repo)

- OAuth start + callback:
  - `GET /api/mercadopago/oauth/authorize`
  - `GET /api/mercadopago/webhook` (callback handler)
  - `GET /api/mercadopago/oauth/callback` (legacy alias)
- Webhooks:
  - `POST /api/mercadopago/webhook`
  - `POST /api/mercadopago/webhook/test`
- Tenant data model:
  - `mercadopago_credentials` (extended v12: `refresh_token`, `token_expires_at`, `refreshed_at`)
  - `mercadopago_access_requests`
  - `payment_sync_attempts`
- Runtime events/status:
  - `order.payment.mercadopago.start`
  - webhook handling for `payment`, `point_integration_wh`, `mp-connect`
- Token lifecycle hardening (completed in this branch):
  - `access_token` + `refresh_token` encrypted at rest via AES-256-GCM (`lib/services/mercadopago/tokenCrypto.ts`)
  - Auto-refresh 60 s before expiry (`credentialsService.ts` → `refreshCredentialsIfNeeded()`)
  - Opportunistic re-encryption of legacy plaintext rows on first read
  - Credential `status: "error"` written on refresh failure for operator visibility

## 4) Gaps Blocking “Perfect Documentation + PR”

### A. Platform billing entitlement domain

Missing first-class domain for tenant subscription lifecycle:

- `tenant_subscriptions`
- `tenant_entitlements`
- optional `tenant_billing_events`

Required behavior:

- Guard MP operational mutations/commands when entitlement is inactive.

### B. Token lifecycle hardening

Missing/partial:

- Encryption at rest for `access_token` and `refresh_token`.
- Refresh token flow + retry policy.
- Explicit disconnect/deauthorization semantics and audit completeness.

### C. Webhook operations maturity

Need explicit runbook coverage for:

- idempotency strategy,
- replay handling,
- retry/alert thresholds,
- correlation IDs and dashboard triage.

## 5) “App Not Finished Yet” Triage Checklist

When OAuth redirection fails with app-readiness style errors, verify in order:

1. **Application details are fully completed** in Mercado Pago dashboard.
2. **Redirect URL is static and exact** match with runtime callback URL.
3. **Environment mode consistency** (test vs production credentials/endpoints).
4. **Production credentials activation** is complete (business data + required terms).
5. **OAuth permissions/scopes** are aligned with requested operations.
6. **PKCE expectation**: if enabled in app settings, runtime must send `code_challenge` / verifier flow.

## 6) Official Knowledge References (Markdown-first)

Use markdown-compatible docs URLs whenever possible.

### OAuth and credentials

- OAuth overview:
  - https://www.mercadopago.com.mx/developers/en/docs/security/oauth.md
- OAuth token creation:
  - https://www.mercadopago.com.mx/developers/en/docs/security/oauth/creation.md
- OAuth token renewal:
  - https://www.mercadopago.com.mx/developers/en/docs/security/oauth/renewal.md
- App details (redirect URL, permissions, quality):
  - https://www.mercadopago.com.mx/developers/en/docs/your-integrations/application-details.md
- Credentials (activation + production/test model):
  - https://www.mercadopago.com.mx/developers/en/docs/your-integrations/credentials.md

### Webhooks and notification contract

- Webhooks:
  - https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks.md
- Additional notification formats:
  - https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/additional-info.md

### In-person payments (Point / PDV)

- Point payment processing:
  - https://www.mercadopago.com.mx/developers/es/docs/mp-point/payment-processing.md
- Point notifications:
  - https://www.mercadopago.com.mx/developers/es/docs/mp-point/notifications.md
- Point go-live guidance:
  - https://www.mercadopago.com.mx/developers/es/docs/mp-point/go-to-production.md

Fallback rule:

- If `.md` returns 404 for a path, consume the equivalent HTML URL and document that fallback in the PR notes.

## 7) PR Acceptance Criteria for Issue 24

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Platform-vs-tenant flow separation is explicit and reflected in endpoint strategy | ✅ Documented |
| 2 | Soft-gate entitlement checks specified for OAuth + payment operations | ⚠️ Documented; not implemented |
| 3 | OAuth readiness checklist complete and testable | ✅ Done (section 5 above) |
| 4 | Webhook contract includes signature validation, tenant resolution, idempotency, retry behavior | ⚠️ Partial — see `MERCADOPAGO_WEBHOOK_OBSERVABILITY_RUNBOOK.md` |
| 5 | PDV and QR flows include happy-path + failure-path lifecycle | ⚠️ Partial — see `MERCADOPAGO_PDV_MIGRATION.md` |
| 6 | Security controls include token secrecy, at-rest protection plan, disconnect behavior | ✅ Encryption done; disconnect audit pending |
| 7 | Runbook references for support/operations are present | ✅ Four runbooks created in `docs/` |

## 8) Proposed PR Breakdown

### PR 1 — Entitlement soft-gate

- Add entitlement checks to MP operational procedures/routes.
- Add UX copy for blocked operations when subscription is inactive.

### PR 2 — Credential lifecycle hardening

- Token encryption at rest.
- Refresh token renewal job + retries.
- Disconnect/deauthorization consistency pass.

### PR 3 — Webhook observability and runbook

- Idempotency key strategy finalized.
- Alerting thresholds and structured logs documented.
- Triage runbook published.

## 9) Open Questions to Resolve Before Merge

1. Will platform billing use Mercado Pago subscriptions directly in this app, or a dedicated billing service boundary?
2. Do we require PKCE from day one for OAuth authorization code flow?
3. Should each tenant support multiple MP accounts after MVP, or stay single-account long-term?
4. What is the grace-period rule for soft-gate entitlement transitions?

---

Status: prepared for Issue 24 discussion enrichment and PR description reuse.