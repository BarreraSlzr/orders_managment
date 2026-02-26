# MercadoPago Approach — Payment & Billing

> Generated from quality checklist audit, codebase scan, and MP documentation.
> Two MP apps registered: **MP-Point** (2318642168506769) for tenant payments, **Billing** (6186158011206269) for platform subscriptions.

---

## 1 — Quality Checklist vs Code: Gap Matrix

### Implementation Requirements (7 items — all must pass for homologation)

| # | Requirement | API Name | Status | File / Notes |
|---|-------------|----------|--------|--------------|
| 1 | Collection on Point device | `point_payment` | ✅ Done | `paymentService.ts` → `createPDVPaymentIntent()` uses `POST /v1/orders` |
| 2 | PDV integration via payment_intent | `payment_intent_id` | ✅ Done | Same — new Orders API, X-Idempotency-Key header |
| 3 | Store/Branch admin via API | `API for store creation` | ✅ Done | `storeService.ts` — CRUD + auto-provisioned on OAuth connect |
| 4 | POS admin via API | `API for POS creation` | ✅ Done | `posService.ts` — CRUD + auto-provisioned on OAuth connect |
| 5 | External reference for reconciliation | `external_reference` | ✅ Done | `orderId` sent as `external_reference` in both QR + PDV |
| 6 | Webhook notifications | `webhooks_point` | ✅ Done | Configured on both MP apps via dashboard |
| 7 | Centralized credentials | `Centralized credentials` | ✅ Done | `credentialsService.ts` — DB-backed, encrypted, auto-refresh |

### Good Practices (18 items — improve quality score)

| # | Practice | API Name | Status | Notes |
|---|----------|----------|--------|-------|
| 1 | Rejected payment flow test | `Case 2` | ⚠️ Partial | Webhook handler maps `rejected`, no E2E test |
| 2 | Cancel payment intent | `cancel_payment_intent` | ✅ Done | `cancelPDVPaymentIntent()` via `DELETE /v1/orders/{id}` |
| 3 | Refunds at checkout | `refunds` | ✅ Done | `refundService.ts` — full + partial refunds via `POST /v1/payments/{id}/refunds` |
| 4 | Search API after notification | `Search API` | ⚠️ Partial | `fetchPaymentDetails()` fetches single payment, no search endpoint |
| 5 | Implementation manual | `implementation_users_manual` | ❌ Missing | No merchant-facing setup doc |
| 6 | Logs | `Logs` | ✅ Done | Console logging throughout all services |
| 7 | Operations manual | `Operation User's Manual` | ❌ Missing | No merchant-facing operational doc |
| 8 | List terminals by API | `List Devices` | ✅ Done | `listTerminals()` via `GET /terminals/v1/list` |
| 9 | Device mode switch (PDV/Standalone) | `Switch device mode` | ✅ Done | `switchDeviceMode()` via `PATCH /point/integration-api/devices/{id}` |
| 10 | Device alerts | `alert_device_system` | ❌ Missing | No device reset/disconnect notifications |
| 11 | Access token as header | `header_token_point` | ✅ Done | `Authorization: Bearer` in `mpFetch()` |
| 12 | Query notified payment | `payment_get_or_search_api` | ✅ Done | `fetchPaymentDetails()` in webhook handler |
| 13 | Integrator ID | `integrator_id` | ✅ Done | `X-Integrator-Id` sent via `mpFetch()` when `MP_INTEGRATOR_ID` is set |
| 14 | Platform ID / Sponsor ID | `platform_id/sponsor_id` | ✅ Done | `X-Platform-Id` sent via `mpFetch()` when `MP_PLATFORM_ID` is set |
| 15 | Refunds API | `refunds_api` | ✅ Done | Same as #3 |
| 16 | Settlement report | `settlement` | ❌ Missing | No report integration |
| 17 | All transactions report | `release` | ❌ Missing | No report integration |
| 18 | Configurable credentials | `Configurable credentials` | ✅ Done | OAuth flow per-merchant |

### Summary Scores

- **Implementation**: 7/7 passing (100%) — ✅ All homologation blockers resolved
- **Good Practices**: 12/18 passing (67%) — remaining gaps: rejected E2E test, search API, manuals, device alerts, reports

---

## 2 — Payment Flow: Action Plan

### Phase A: Unblock Homologation (3 blockers)

#### A1. Configure Webhooks on MP App
**Tool**: `mcp_mercadopago-m_save_webhook` — ✅ **Done**
```
Application: 2318642168506769
URL: https://orders.internetfriends.xyz/api/mercadopago/webhook
Events: payment, point_integration_wh, mp-connect, order, topic_claims_integration_wh
```

#### A2. Store Management API — ✅ **Done**
File: `lib/services/mercadopago/storeService.ts`
```
POST   /users/{user_id}/stores          → createStore()
GET    /users/{user_id}/stores          → listStores()
PUT    /users/{user_id}/stores/{id}     → updateStore()
DELETE /users/{user_id}/stores/{id}     → deleteStore()
```
**Auto-provisioned** on OAuth connect via `mercadopago.credentials.upserted` handler.

#### A3. POS Management API — ✅ **Done**
File: `lib/services/mercadopago/posService.ts`
```
POST   /pos                             → createPos()
GET    /pos                             → listPos()
PUT    /pos/{id}                        → updatePos()
DELETE /pos/{id}                        → deletePos()
```
**Auto-provisioned** on OAuth connect, linked to Store via `store_id`.

### Phase B: Key Good Practices

#### B1. Refunds API — ✅ **Done**
File: `lib/services/mercadopago/refundService.ts`
```
POST /v1/payments/{payment_id}/refunds          → full refund
POST /v1/payments/{payment_id}/refunds {amount}  → partial refund
GET  /v1/payments/{payment_id}/refunds           → list refunds
GET  /v1/payments/{payment_id}/refunds/{id}      → get refund
```
Includes `X-Idempotency-Key` header for safe retries.

#### B2. Device Mode Switch — ✅ **Done**
Added to `paymentService.ts` → `switchDeviceMode()`:
```
PATCH /point/integration-api/devices/{device_id}
Body: { operating_mode: "PDV" | "STANDALONE" }
```

#### B3. Integrator / Platform ID Headers — ✅ **Done**
`mpFetch.ts` sends `X-Integrator-Id` and `X-Platform-Id` headers when `MP_INTEGRATOR_ID` / `MP_PLATFORM_ID` env vars are set. Optional — only for certified MP partners.

#### B4. Search API
Payment search (`GET /v1/payments/search?external_reference={orderId}`) — not yet implemented. Low priority since `fetchPaymentDetails()` covers the webhook reconciliation path.

---

## 3 — Billing Flow: Action Plan

### Current State
| Component | Status |
|-----------|--------|
| Billing MP App (6186158011206269) | ✅ Registered (not homologable — subscriptions product) |
| `/api/billing/mercadopago/webhook` route | ✅ Exists — HMAC validation + `processBillingEvent()` |
| `billingWebhookService.ts` | ✅ Handles `subscription.activated/past_due/grace_start/canceled/expired/reactivated` |
| `checkEntitlement.ts` | ✅ Feature gate with `ENTITLEMENT_ENABLED` env var (default: allow all) |
| DB tables | ✅ `tenant_subscriptions`, `tenant_entitlements`, `tenant_billing_events` |
| Subscription creation API | ❌ **Missing** — no `POST /preapproval_plan` or `POST /preapproval` |
| Tenant subscription UI | ❌ **Missing** — no checkout/subscribe flow |
| Billing webhook configured | ✅ **Done** — configured on MP Billing app via dashboard |

### Billing Action Items

#### C1. Create Subscription Plan (one-time setup)
```
POST https://api.mercadopago.com/preapproval_plan
{
  "reason": "Orders Management — Plan Mensual",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": <price>,
    "currency_id": "MXN"
  },
  "back_url": "https://<domain>/onboardings/billing/callback",
  "payment_methods_allowed": { "payment_types": [{ "id": "credit_card" }, { "id": "debit_card" }] }
}
```

#### C2. Subscription Initiation Service
New file: `lib/services/billing/subscriptionService.ts`
```
POST /preapproval  → createSubscription({ planId, payerEmail, tenantId })
GET  /preapproval/{id}  → getSubscription()
PUT  /preapproval/{id}  → updateSubscription() (pause/modify)
```
Returns `init_point` URL → redirect tenant to MP checkout.

#### C3. Configure Billing Webhook — ✅ **Done**
Configured via `mcp_mercadopago-m_save_webhook`:
```
Application: 6186158011206269
URL: https://orders.internetfriends.xyz/api/billing/mercadopago/webhook
Events: subscription_preapproval, subscription_authorized_payment, payment, mp-connect, topic_claims_integration_wh, subscription_preapproval_plan
```

#### C4. Billing Onboarding UI Flow
New workflow at `/onboardings/billing`:
1. Tenant selects plan → redirect to MP `init_point` URL
2. MP callback → `/onboardings/billing/callback` → parse preapproval_id
3. Store in `tenant_subscriptions` + activate entitlement
4. Redirect to settings with success message

---

## 4 — Playwright Testing Strategy

### Test Users Setup
```
mcp_mercadopago-m_create_test_user(site_id="MLM")  → seller test user
mcp_mercadopago-m_create_test_user(site_id="MLM")  → buyer test user
mcp_mercadopago-m_add_money_test_user(user_id=<buyer>, amount=10000)
```

### E2E Test Scenarios (Playwright MCP)

#### T1. OAuth Flow
```
1. Navigate to localhost:3000/login → sign in as test tenant
2. Go to Settings → Connect Mercado Pago
3. Verify redirect to auth.mercadopago.com.mx/authorization
4. Complete OAuth grant with test seller credentials
5. Verify callback → credentials stored → terminal list populated
```

#### T2. PDV Payment (Point Terminal)
```
1. Create order with products
2. Click "Cobrar con Mercado Pago" → select PDV flow
3. Verify POST /v1/orders creates payment intent
4. Simulate webhook: mcp_mercadopago-m_simulate_webhook(...)
5. Verify order status updates to "approved"
```

#### T3. QR Payment
```
1. Create order
2. Select QR flow → verify QR code displayed
3. Simulate payment via webhook
4. Verify reconciliation via external_reference
```

#### T4. Rejected Payment (Checklist Case 2)
```
1. Create payment intent
2. Simulate rejected webhook notification
3. Verify order status shows "rejected"
4. Verify user can retry payment
```

#### T5. Cancel Payment Intent
```
1. Create payment intent (PDV)
2. Cancel before terminal processes
3. Verify DELETE /v1/orders/{id} called
4. Verify DB status → "canceled"
```

#### T6. Billing Subscription (Sub Goal)
```
1. Navigate to billing/subscription page
2. Select plan → redirect to MP subscription checkout
3. Simulate subscription.activated webhook
4. Verify entitlement gate allows MP features
5. Simulate subscription.canceled → verify features blocked
```

### Webhook Simulation
Use `mcp_mercadopago-m_simulate_webhook` OR the existing test endpoint:
```
POST /api/mercadopago/webhook/test
```

---

## 5 — Execution Priority

### P0 — Immediate (unblocks everything)
1. **Configure webhooks** on MP-Point app via MCP tool
2. **Create test users** (seller + buyer) for Mexico (MLM)
3. **Verify OAuth flow** end-to-end with Playwright

### P1 — Payment Foundation
4. Implement **Store service** (A2) + **POS service** (A3)
5. Wire Store/POS creation into onboarding workflow
6. Run **PDV payment E2E** test (T2)
7. Run **QR payment E2E** test (T3)

### P2 — Payment Maturity
8. Add **Refunds API** (B1)
9. Add **Device mode switch** (B2)
10. Add **Integrator/Platform ID** headers (B3)
11. Run **rejected payment test** (T4) + **cancel intent test** (T5)

### P3 — Billing (Sub Goal)
12. Create **subscription plan** on MP Billing app (C1)
13. Implement **subscription service** (C2)
14. Configure **billing webhook** (C3)
15. Build **billing onboarding UI** (C4)
16. Run **billing E2E** test (T6)

### P4 — Polish
17. Settlement + transaction reports (good practice)
18. Device alerts subscription
19. Implementation & operations manuals
20. Run `mcp_mercadopago-m_quality_evaluation` to get final score

---

## 6 — Environment Variables Required

### Payment (MP-Point App)
```env
MP_CLIENT_ID=2318642168506769          # Already set
MP_CLIENT_SECRET=<secret>              # Already set
MP_REDIRECT_URI=/api/mercadopago/webhook  # Already set
MP_WEBHOOK_SECRET=<hmac_secret>        # Set when configuring webhook
MP_AUTH_BASE_URL=https://auth.mercadopago.com.mx
MP_API_BASE_URL=https://api.mercadopago.com.mx
MP_TOKENS_ENCRYPTION_KEY=<aes_key>     # Already set (or AUTH_SECRET fallback)

# New — for good practices
MP_INTEGRATOR_ID=<from_dev_program>    # Optional
MP_PLATFORM_ID=<from_dev_program>      # Optional
```

### Billing (Billing App)
```env
MP_BILLING_CLIENT_ID=6186158011206269
MP_BILLING_CLIENT_SECRET=<billing_secret>
MP_BILLING_WEBHOOK_SECRET=<billing_hmac>
MP_BILLING_PLAN_ID=<preapproval_plan_id>  # After plan creation
ENTITLEMENT_ENABLED=true               # Currently false by default
```

---

## 7 — File Map (New + Modified)

### New Files
| File | Purpose |
|------|---------|
| `lib/services/mercadopago/storeService.ts` | Store CRUD (A2) |
| `lib/services/mercadopago/posService.ts` | POS CRUD (A3) |
| `lib/services/mercadopago/refundService.ts` | Refund API (B1) |
| `lib/services/billing/subscriptionService.ts` | Subscription plan + create (C2) |
| `app/onboardings/billing/page.tsx` | Billing onboarding UI (C4) |
| `app/onboardings/billing/callback/page.tsx` | Billing callback handler (C4) |
| `tests/e2e/mercadopagoPayment.spec.ts` | Payment E2E tests (T1-T5) |
| `tests/e2e/mercadopagoBilling.spec.ts` | Billing E2E tests (T6) |

### Modified Files
| File | Change |
|------|--------|
| `lib/services/mercadopago/paymentService.ts` | Add device mode switch (B2), add integrator/platform headers (B3) |
| `lib/events/contracts.ts` | Add store/POS domain events |
| `lib/events/handlers.ts` | Wire store/POS + refund handlers |
| `components/Admin/SettingsPanel.tsx` | Add Store/POS management UI |
| `app/onboardings/[workflow]/page.tsx` | Add billing workflow step |
