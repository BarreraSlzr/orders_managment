# Mercado Pago — PDV Migration Analysis (Legacy → New Orders API)

Decision record and migration guide for moving from the legacy Point Payment
Intent API to the new Point Orders API.

See also:
- [API Endpoint Analysis §1.6 and §6](./MERCADOPAGO_API_ENDPOINTS.md)
- [Webhook Observability Runbook](./MERCADOPAGO_WEBHOOK_OBSERVABILITY_RUNBOOK.md)

---

## 1. Current State

The app uses the **Legacy Point Payment Intent API**:

```
POST https://api.mercadopago.com/point/integration-api/devices/{device_id}/payment-intents
```

MP labels this endpoint as **"POINT (LEGACY)"** in its developer reference and
recommends the new Orders API for new integrations.

### Fixes applied in this branch

The following legacy API issues were corrected before this migration decision was
formally documented:

| Fix | Description |
|-----|-------------|
| Amount format | Changed from `amountCents / 100` (float) to `amountCents` (integer cents) |
| `payment.type` field | Removed undocumented `payment: { type: "debit_card" }` from request body |
| Terminal schema | `listTerminals()` now reads correct `data.terminals[]` response path |

---

## 2. Legacy API vs. New Orders API (Comparison)

| Aspect | Legacy API | New Orders API |
|--------|-----------|----------------|
| Endpoint | `POST /point/integration-api/devices/{device_id}/payment-intents` | `POST /v1/orders` |
| Amount format | Integer cents (e.g., `1500` = $15.00 MXN) | Decimal string (e.g., `"15.00"`) |
| Idempotency key | Not required | Required (`X-Idempotency-Key` header) |
| `payment.type` | Not supported | Via `config.payment_method.default_type` |
| Device reference | URL path param `{device_id}` | `config.point.terminal_id` in body |
| Response shape | `{ id, status }` simple intent | Full `order` object with nested `transactions` |
| Webhook events | `point_integration_wh` | Mixed — may emit both order-level and payment-level events |
| MP reference label | "POINT (LEGACY)" | "IN-PERSON PAYMENTS" |

### Legacy API request

```typescript
// POST /point/integration-api/devices/{deviceId}/payment-intents
{
  amount: 1500,                    // integer cents
  description: "Orden #123",
  additional_info: {
    external_reference: "order-uuid",
    print_on_terminal: true
  }
}
```

### New Orders API request

```typescript
// POST /v1/orders
// Headers: X-Idempotency-Key: <uuid>
{
  type: "point",
  external_reference: "order-uuid",
  transactions: {
    payments: [{ amount: "15.00" }]
  },
  config: {
    point: {
      terminal_id: "<device_id>",
      print_on_terminal: "full_ticket"
    },
    payment_method: {
      default_type: "credit_card"  // or "debit_card", "any"
    }
  },
  description: "Orden #123"
}
```

---

## 3. Decision

**Current decision: Stay on legacy API for the initial production release.**

Rationale:

1. The legacy API is still functional and documented; MP has not announced a
   deprecation date for the Mexico region.
2. The critical bugs (amount format, terminal schema mismatch) have been fixed,
   making the legacy API production-viable.
3. Migrating to the new Orders API requires:
   - Changes to request shape and response parsing
   - Addition of `X-Idempotency-Key` header generation
   - Webhook handler updates for potential new event format
   - Regression testing on physical terminal hardware
4. The value of migration is higher correctness alignment with MP's roadmap
   but the risk exceeds benefit for the initial cut.

**Trigger for revisiting:** If MP announces legacy API end-of-life for Mexico, or
if the legacy API begins returning errors in production, migration to the new
Orders API should be fast-tracked.

---

## 4. Migration Implementation Plan

If/when migration is approved, follow these steps:

### Step 1 — Update `createPDVPaymentIntent()`

File: `lib/services/mercadopago/paymentService.ts`

Changes:
- Switch endpoint from `/point/integration-api/devices/{deviceId}/payment-intents`
  to `POST /v1/orders`
- Change amount from integer cents `amountCents` to decimal string `(amountCents / 100).toFixed(2)`
- Restructure body to new schema (see §2 above)
- Add `X-Idempotency-Key` header (generate UUID per request)

```typescript
// New implementation sketch
export async function createPDVPaymentIntent({
  accessToken,
  deviceId,
  orderId,
  amountCents,
  description,
}: CreatePDVParams): Promise<MpOrderResult> {
  return mpFetch({
    url: `${MP_API_BASE}/v1/orders`,
    method: "POST",
    token: accessToken,
    headers: {
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: {
      type: "point",
      external_reference: orderId,
      transactions: {
        payments: [{ amount: (amountCents / 100).toFixed(2) }],
      },
      config: {
        point: { terminal_id: deviceId, print_on_terminal: "full_ticket" },
        payment_method: { default_type: "any" },
      },
      description,
    },
  });
}
```

### Step 2 — Update `MpPDVPaymentIntentResult` type

File: `lib/sql/types.ts` or `lib/services/mercadopago/paymentService.ts`

```typescript
// New response shape
interface MpOrderResult {
  id: string;
  status: "open" | "closed" | "expired";
  external_reference: string;
  transactions: {
    payments: Array<{ id: string; amount: string; status: string }>;
  };
}
```

### Step 3 — Update webhook handler for order-level events

File: `lib/services/mercadopago/webhookService.ts`

Potential new event type from new API:

```typescript
case "order":
  // payload.data.id is the order ID, not a payment ID
  await handleOrderWebhook({ orderId: payload.data.id, tenantId });
  break;
```

Verify with MP documentation whether the new Orders API sends `type: "payment"`
or a new event type.

### Step 4 — Update `listTerminals()` if needed

The terminals endpoint (`GET /point/integration-api/devices`) is the same for
both APIs — no change needed.

### Step 5 — Write and run tests

- Unit tests for new request shape and response parsing
- Integration test with MP sandbox (`x-test-scope: sandbox` header required)
- End-to-end test on physical terminal in test mode

---

## 5. Open Questions

1. Does the new Orders API (`POST /v1/orders`) work in Mexico (MLM) sandbox?
   Official docs examples use Brazil (MLB) amounts.
2. What webhook `type` value does the new API send for terminal payment events?
   Documentation shows `order` but this needs to be confirmed empirically.
3. Should `print_on_terminal` be `"full_ticket"`, `"no_ticket"`, or configurable
   per-order?

---

## 6. References

- Legacy API reference: <https://www.mercadopago.com.mx/developers/en/reference/point_apis_mlm/_point_integration-api_devices_deviceid_payment-intents/post>
- New Orders API reference: <https://www.mercadopago.com.mx/developers/en/reference/in-person-payments/point/orders/create-order/post>
- Point general docs: <https://www.mercadopago.com.mx/developers/es/docs/mp-point/payment-processing.md>
- Implementation: `lib/services/mercadopago/paymentService.ts`
