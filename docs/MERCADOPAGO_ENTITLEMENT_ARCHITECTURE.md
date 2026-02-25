# Mercado Pago — Entitlement Architecture

Defines the platform subscription + entitlement domain that gates tenant access
to Mercado Pago operational features (OAuth connect, PDV/QR payments).

See also:
- [Platform + Tenant Architecture](./MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)
- [Issue 24 Context](./MERCADOPAGO_ISSUE_24_CONTEXT.md)

> **Status: Design document — not yet implemented.**  
> This doc defines the schema, guard strategy, and UI copy needed for PR 1 (Entitlement soft-gate).

---

## 1. Why a Separate Entitlement Domain

Two independent financial flows must stay decoupled:

| Flow | Payer | Who receives |
|------|-------|--------------|
| Platform subscription | Tenant pays us | Our platform subscription account |
| Tenant customer payments | Customer pays tenant | Tenant's own MP account |

Entitlements express the _output_ of the platform subscription — whether the tenant
is authorized to use paid Mercado Pago features — without coupling to a specific
billing provider.

---

## 2. Target Schema

### `tenant_subscriptions`

Tracks the billing contract between tenant and our platform.

```sql
CREATE TABLE tenant_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 TEXT NOT NULL,
  provider                  TEXT NOT NULL,           -- 'mercadopago' | 'stripe' | 'manual'
  external_subscription_id  TEXT,                    -- provider's subscription ID
  status                    TEXT NOT NULL,           -- see §3
  current_period_end        TIMESTAMPTZ,
  canceled_at               TIMESTAMPTZ,
  metadata                  JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON tenant_subscriptions (tenant_id, provider)
  WHERE status NOT IN ('canceled', 'expired');
```

### `tenant_entitlements`

Computed/cached entitlement state per tenant. Updated by webhooks and billing events.

```sql
CREATE TABLE tenant_entitlements (
  tenant_id         TEXT PRIMARY KEY,
  subscription_status  TEXT NOT NULL,          -- mirrors subscription status or 'none'
  features_enabled  TEXT[] NOT NULL DEFAULT '{}',
  grace_period_end  TIMESTAMPTZ,              -- null when no grace period
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `tenant_billing_events` (optional, for audit)

```sql
CREATE TABLE tenant_billing_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  event_type TEXT NOT NULL,   -- 'subscription.created' | 'payment.failed' | 'subscription.canceled' etc.
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Subscription Status FSM

```
none → active → past_due → grace_period → canceled
                         ↘              ↗
                          → reactivated
```

| Status | Meaning | MP features allowed |
|--------|---------|---------------------|
| `none` | No subscription record | ❌ Blocked |
| `active` | Paid and current | ✅ Full access |
| `past_due` | Payment failed; waiting | ⚠️ Grace period applies |
| `grace_period` | Temporary extension | ✅ Full access until `grace_period_end` |
| `canceled` | Tenant canceled | ❌ Blocked |
| `expired` | Past due too long | ❌ Blocked |

Default grace period: **7 days** after payment failure (configurable).

---

## 4. Entitlement Check API

### Helper function

```typescript
// lib/services/entitlements/checkEntitlement.ts

export async function checkMpEntitlement({
  tenantId,
}: {
  tenantId: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const ent = await db
    .selectFrom("tenant_entitlements")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  if (!ent) return { allowed: false, reason: "no_subscription" };

  const allowed = ["active", "grace_period"].includes(ent.subscription_status);
  if (!allowed) return { allowed: false, reason: ent.subscription_status };

  if (ent.subscription_status === "grace_period" && ent.grace_period_end) {
    if (new Date(ent.grace_period_end) < new Date()) {
      return { allowed: false, reason: "grace_period_expired" };
    }
  }

  return { allowed: true };
}
```

---

## 5. Guard Placement

### API routes

| Route | Guard type | Behavior when blocked |
|-------|-----------|----------------------|
| `GET /api/mercadopago/oauth/authorize` | Hard block | Redirect to `/?mp_oauth=entitlement_error` |
| Event handler `order.payment.mercadopago.start` | Hard block | Return `{ success: false, reason: "entitlement_inactive" }` |
| tRPC `mercadopago.payment.startQR` | Hard block | Throw `TRPCError({ code: "FORBIDDEN" })` |
| tRPC `mercadopago.payment.startPDV` | Hard block | Throw `TRPCError({ code: "FORBIDDEN" })` |
| tRPC `mercadopago.credentials.get` | Soft — always allow | Show "subscription required" copy in UI |

### Implementation pattern

```typescript
// In any tRPC procedure or API route handler:
import { checkMpEntitlement } from "@/lib/services/entitlements/checkEntitlement";

const { allowed, reason } = await checkMpEntitlement({ tenantId });
if (!allowed) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `MP entitlement inactive: ${reason}`,
  });
}
```

---

## 6. UI Copy (Spanish, soft-gate messages)

These strings should appear in the UI when MP features are blocked:

| Context | Copy |
|---------|------|
| Connect button disabled | _"Necesitas una suscripción activa para conectar Mercado Pago."_ |
| Payment button disabled | _"Los pagos con Mercado Pago no están disponibles con tu plan actual."_ |
| Past due banner | _"Tu suscripción tiene un pago pendiente. Tienes [N] días para regularizarla antes de que se deshabiliten los pagos."_ |
| Grace period banner | _"Pagos activos en período de gracia hasta [fecha]. Actualiza tu método de pago."_ |
| Canceled / expired | _"Tu suscripción fue cancelada. Renueva para volver a habilitar los pagos con Mercado Pago."_ |

---

## 7. Billing Webhook Route (Recommended)

Add a dedicated route for platform billing events distinct from tenant payment webhooks:

```
POST /api/billing/mercadopago/webhook
```

Handler responsibilities:
1. Validate HMAC signature from billing provider.
2. Upsert `tenant_subscriptions` from event payload.
3. Recompute and write `tenant_entitlements`.
4. Write to `tenant_billing_events` for audit.
5. Return `200` always (prevent retry storms).

---

## 8. Delivery Checklist (PR 1)

- [ ] Create DB migrations for `tenant_subscriptions`, `tenant_entitlements`, `tenant_billing_events`
- [ ] Implement `checkMpEntitlement()` helper
- [ ] Add entitlement guard to `/api/mercadopago/oauth/authorize`
- [ ] Add entitlement guard to tRPC `mercadopago.payment.*` procedures
- [ ] Add entitlement guard to `order.payment.mercadopago.start` event handler
- [ ] Wire soft UI copy for each blocked surface
- [ ] Add `POST /api/billing/mercadopago/webhook` stub
- [ ] Integration tests: active/inactive/grace entitlement paths
- [ ] Document grace period configuration

---

## 9. Open Questions

1. Will platform billing use Mercado Pago Subscriptions directly, or a separate provider?
2. Do we need multi-feature granularity (e.g., block PDV but allow QR separately)?
3. What is the exact grace period duration? 7 days is the suggested default.
4. Should billing events be queryable by the tenant via a UI panel?
