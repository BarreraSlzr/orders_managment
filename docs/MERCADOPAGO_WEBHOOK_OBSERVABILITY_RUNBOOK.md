# Mercado Pago — Webhook Observability Runbook

Operator reference for monitoring, debugging, and recovering from MP webhook
delivery issues and payment reconciliation drift.

See also:
- [API Endpoint Analysis §2.2](./MERCADOPAGO_API_ENDPOINTS.md)
- [Platform + Tenant Architecture](./MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)

---

## 1. Webhook Architecture Overview

The platform has **two independent webhook pipelines** — one per MP app:

```
MP-Point App (2318642168506769) — Tenant payment events
  │
  ├── POST /api/mercadopago/webhook   (production — HMAC: MP_WEBHOOK_SECRET)
  └── POST /api/mercadopago/webhook/test  (sandbox — no HMAC)
        │
        └── webhookService.processWebhook()
              ├── Resolve tenant via mercadopago_credentials.user_id
              ├── Route by event type:
              │     ├── "payment"              → fetch payment details → update payment_sync_attempts
              │     ├── "point_integration_wh" → update PDV attempt status
              │     └── "mp-connect"           → credential lifecycle audit
              └── Return 200 always

Billing App (6186158011206269) — Platform subscription events
  │
  ├── POST /api/billing/mercadopago/webhook   (production — HMAC: MP_BILLING_WEBHOOK_SECRET)
  └── POST /api/billing/mercadopago/webhook/test  (sandbox — no HMAC)
        │
        └── billingWebhookService.processBillingEvent()
              ├── Route by event type:
              │     ├── "subscription_preapproval"          → upsert tenant_subscriptions
              │     ├── "subscription_authorized_payment"   → update subscription status
              │     └── "payment" / "mp-connect"            → audit logging
              ├── Recompute tenant_entitlements
              ├── Write tenant_billing_events (audit)
              └── Return 200 always
```

MP retry policy:
- Retries non-2xx responses every **15 minutes for 3 days** (288 retries maximum).
- Our handler always returns 200 to prevent retry storms.

---

## 2. Idempotency Strategy

### Problem

MP may deliver the same notification multiple times (at-least-once delivery). Our
handler must be safe to run multiple times for the same event.

### Current behavior

The handler fetches the latest payment status from the MP API on every call and writes
it to `payment_sync_attempts`. This is idempotent if the final status is the same —
the write is an upsert by `external_reference` / `attempt_id`.

### Recommended enhancement

Add explicit idempotency tracking:

```sql
-- Add to payment_sync_attempts or create a new table
ALTER TABLE payment_sync_attempts
  ADD COLUMN IF NOT EXISTS last_mp_notification_id TEXT,
  ADD COLUMN IF NOT EXISTS last_processed_at        TIMESTAMPTZ;
```

In the handler:
```typescript
// Skip if already processed this exact notification
const existing = await db
  .selectFrom("payment_sync_attempts")
  .select("id")
  .where("last_mp_notification_id", "=", notificationId)
  .executeTakeFirst();

if (existing) {
  return { status: "already_processed" };
}
```

MP provides a notification ID in the request body (`data.id`). Use this as the
idempotency key.

---

## 3. Correlation IDs

Every webhook handler log line must include:

| Field | Source | Example |
|-------|--------|---------|
| `tenant_id` | Resolved from `user_id` lookup | `tenant_abc123` |
| `mp_user_id` | From webhook payload `user_id` | `123456789` |
| `mp_notification_id` | `data.id` from payload | `123456789` |
| `mp_request_id` | `x-request-id` header from MP | `req-xxxxxxxx` |
| `event_type` | `type` field from payload | `payment` |
| `external_reference` | From fetched payment details | `order-uuid-here` |

**Structured log format (recommended):**
```typescript
logger.info("mp_webhook_received", {
  tenant_id: tenantId,
  mp_user_id: payload.user_id,
  mp_notification_id: payload.data?.id,
  mp_request_id: req.headers["x-request-id"],
  event_type: payload.type,
});
```

---

## 4. HMAC Signature Validation

MP signs webhook delivery with the `x-signature` header when `MP_WEBHOOK_SECRET` is set.

**Signature format:**
```
x-signature: ts=<timestamp>,v1=<hmac>
```

**Manifest string:**
```
id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
```

**Validation pseudocode:**
```typescript
const manifest = `id:${payload.data.id};request-id:${requestId};ts:${ts};`;
const expected = createHmac("sha256", MP_WEBHOOK_SECRET).update(manifest).digest("hex");
if (expected !== receivedHmac) throw new Error("Invalid webhook signature");
```

> If `MP_WEBHOOK_SECRET` is not set, signature validation is skipped (development only).
> In production this env var **must** be configured.

---

## 5. Event Types Reference

| `type` value | Meaning | Handler action |
|-------------|---------|----------------|
| `payment` | Payment status change (QR, card, etc.) | Fetch `/v1/payments/{id}`, update `payment_sync_attempts.status` |
| `point_integration_wh` | PDV terminal state change | Update PDV attempt status from `action` field |
| `mp-connect` | Tenant deauthorized app | Mark credentials as `inactive`; emit audit event |

**`point_integration_wh` action values:**

| `action` | Meaning |
|----------|---------|
| `PAYMENT_CREATED` | PDV intent created successfully |
| `PAYMENT_UPDATED` | Payment status changed |
| `ERROR_PAYMENT_CREATION` | PDV intent creation failed |
| `PAYMENT_CANCELED` | Payment was canceled |

---

## 6. Alert Thresholds

| Metric | Source | Alert when |
|--------|--------|-----------|
| Webhook 4xx/5xx responses | Server metrics | Any 5xx; > 5 4xx/minute |
| Unresolved tenant for `user_id` | App log `mp_webhook_unknown_tenant` | Any occurrence |
| Invalid HMAC signatures | App log `mp_webhook_invalid_signature` | Any occurrence |
| `payment_sync_attempts` stuck in `processing` | DB query | Count > 0 for > 30 min |
| `mp-connect` deauth events | App log / DB | Any occurrence (alert ops + tenant) |

**Query — stuck processing attempts:**
```sql
SELECT tenant_id, id, created_at, updated_at, flow
FROM payment_sync_attempts
WHERE status = 'processing'
  AND updated_at < now() - interval '30 minutes'
ORDER BY updated_at;
```

---

## 7. Replay and Recovery

### Manual webhook replay

MP does not provide a self-service replay UI. To manually re-trigger reconciliation:

1. Identify the `payment_id` or `external_reference` (order ID) from logs or DB.
2. Call the MP payment details endpoint directly:
   ```bash
   curl -H "Authorization: Bearer <access_token>" \
     https://api.mercadopago.com/v1/payments/<payment_id>
   ```
3. Compare the returned `status` with `payment_sync_attempts.status`.
4. If drifted, update the attempt status manually or trigger the reconciliation
   tRPC procedure (if implemented).

### Batch reconciliation (recommended future work)

Implement a background job that:
1. Queries `payment_sync_attempts` with `status IN ('processing', 'error')` older than 30 min.
2. Fetches current payment status from MP API.
3. Writes corrected status back.
4. Emits a `payment.reconciled` audit event.

---

## 8. On-Call Triage Steps

### Scenario: Payments not updating in app after customer pays

1. Check MP dashboard — is the payment shown as `approved`?
2. Check app logs for `mp_webhook_received` with matching `external_reference`.
3. If no log entry: verify webhook URL is registered in MP dashboard.
4. If log entry present but status didn't update: check `payment_sync_attempts` row for `error_message`.
5. If `status: error` in MP credentials: tenant tokens may have expired — check `MERCADOPAGO_TOKEN_LIFECYCLE_RUNBOOK.md`.

### Scenario: Webhook signature validation failures in production

1. Verify `MP_WEBHOOK_SECRET` env var matches the secret set in MP dashboard.
2. Check for clock skew (`ts` in header is > 5 min old — MP considers this suspicious).
3. Verify the manifest string construction matches MP documentation exactly.

### Scenario: Tenant receives `mp-connect` deauth webhook

1. `mercadopago_credentials` row for tenant should be set to `inactive`.
2. Notify tenant: their MP connection was revoked and they need to reconnect.
3. Check MP dashboard — was the app revoked by the tenant or by MP?
4. If revoked by MP (suspicious), investigate potential credential compromise.

---

## 9. Sandbox Testing

Use `POST /api/mercadopago/webhook/test` for local development. This endpoint:
- Accepts the same payload format as production.
- Skips HMAC validation.
- Routes to the same `processWebhook()` handler.

To simulate events locally:
```bash
curl -X POST http://localhost:3000/api/mercadopago/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": { "id": "1234567890" },
    "user_id": "<mp_user_id_from_credentials>",
    "action": "payment.updated"
  }'
```

---

## 10. Billing Webhook Observability

### HMAC Validation

Billing webhooks use a separate secret (`MP_BILLING_WEBHOOK_SECRET`) and the same
HMAC-SHA256 validation scheme as tenant payment webhooks. The manifest string format
is identical: `id:{data.id};request-id:{x-request-id};ts:{ts};`.

### Event Types

| `type` value | Meaning | Handler action |
|-------------|---------|----------------|
| `subscription_preapproval` | Subscription created/updated/canceled | Upsert `tenant_subscriptions`, recompute entitlement |
| `subscription_authorized_payment` | Subscription payment succeeded/failed | Update subscription status + period end |
| `payment` | One-time billing payment | Audit log |
| `mp-connect` | App authorization lifecycle | Audit log |

### Alert Thresholds (Billing)

| Metric | Source | Alert when |
|--------|--------|-----------|
| Billing webhook 4xx/5xx | Server metrics | Any 5xx |
| Entitlement flipped to inactive | DB change | Any occurrence (notify ops + tenant) |
| `subscription_authorized_payment` failure | Billing event log | Any `past_due` transition |
| No billing webhooks received in 7 days | Monitoring | Unexpected silence if active subscriptions exist |

### Sandbox Testing

Use `POST /api/billing/mercadopago/webhook/test` with the same structure:
```bash
curl -X POST http://localhost:3000/api/billing/mercadopago/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "subscription_preapproval",
    "data": { "id": "preapproval_12345" },
    "action": "updated"
  }'
```

---

## 11. References

- Webhook handler: `app/api/mercadopago/webhook/route.ts`
- Webhook processing: `lib/services/mercadopago/webhookService.ts`
- MP webhook docs: <https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks>
- MP webhook additional info: <https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/additional-info>
