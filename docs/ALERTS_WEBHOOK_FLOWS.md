# Alerts & Webhook Flows

This document visualises the two distinct Mercado Pago webhook pipelines and how
they both funnel into the `platform_alerts` table, which powers the in-app
Notifications tab.

---

## 1 — Two-App MercadoPago Architecture

Every tenant configures **two separate MP applications**:

```mermaid
flowchart LR
    subgraph Tenant["Tenant MP App (payments)"]
        PA[MP Payment App\nowner = restaurant / store]
    end
    subgraph Platform["Platform MP App (subscriptions)"]
        SA[MP Platform App\nowner = SaaS operator]
    end

    PA -->|"payment, point_integration,\nclaim"| TW["/api/mp/webhooks\n(tenant endpoint)"]
    SA -->|"subscription_preapproval\nsubscription_authorized_payment"| PW["/api/billing/webhooks\n(platform endpoint)"]

    TW --> WS[webhookService.ts]
    PW --> BW[billingWebhookService.ts]

    WS --> PA_TABLE[(payment_sync_attempts)]
    WS --> AL[(platform_alerts)]
    BW --> TS[(tenant_subscriptions)]
    BW --> AL
```

---

## 2 — Payment & Claim Webhook Flow (Tenant App)

```mermaid
sequenceDiagram
    autonumber
    participant MP as Mercado Pago
    participant API as /api/mp/webhooks
    participant WS as webhookService
    participant DB as Database
    participant AL as platform_alerts

    MP->>API: POST {type, data.id, userId}
    API->>WS: processWebhook(notification, tenantId)

    alt type = "payment"
        WS->>DB: upsert payment_sync_attempts (status=pending)
        WS->>MP: GET /v1/payments/{id}
        MP-->>WS: PaymentDetail
        WS->>DB: update attempt (status=approved|rejected|…)
        WS->>DB: update order payment_status
        WS->>AL: createPlatformAlert (type=payment, metadata.order_id)
        Note over WS,AL: severity: approved→info, rejected/canceled→warning, error→critical
    else type = "point_integration"
        WS->>DB: lookup attempt by mp_intent_id
        WS->>DB: update status
        WS->>DB: update order payment_status
        WS->>AL: createPlatformAlert (type=payment, sourceType=mp_point, metadata.order_id)
    else type = "mp-connect" (deauth)
        WS->>DB: mark credentials inactive
        WS->>AL: createPlatformAlert (type=mp_connect, severity=critical)
        Note over WS,AL: No order_id — deauth is account-level
    else type = "claim"
        WS->>MP: GET /v1/claims/{claimId}
        MP-->>WS: ClaimDetail + payment_id
        WS->>DB: SELECT attempt WHERE mp_payment_id = payment_id → {id, order_id}
        par Create alerts
            WS->>AL: createPlatformAlert (scope=tenant, severity=warning, metadata.order_id)
            WS->>AL: createPlatformAlert (scope=admin, severity=warning, metadata.order_id)
        end
        WS->>DB: UPDATE attempt → status=error (if attempt found)
    else type = "subscription_*"
        WS->>WS: handleSubscriptionEvent
        WS->>AL: createPlatformAlert (scope=tenant, type=subscription)
    end

    WS-->>API: {handled: true, detail}
    API-->>MP: 200 OK
```

---

## 3 — Billing Webhook Flow (Platform App → Tenant Subscriptions)

```mermaid
sequenceDiagram
    autonumber
    participant MP as Mercado Pago
    participant API as /api/billing/webhooks
    participant BW as billingWebhookService
    participant DB as tenant_subscriptions
    participant AL as platform_alerts

    MP->>API: POST subscription_preapproval event
    API->>BW: handleBillingWebhook(payload)
    BW->>MP: GET /preapproval/{id}
    MP-->>BW: SubscriptionDetail {status, payer_email, …}

    BW->>DB: upsert tenant_subscriptions (plan, status, next_billing_date)

    alt status = active
        Note over BW,AL: No alert — normal state
    else status = past_due
        BW->>AL: createPlatformAlert (severity=warning, "Pago vencido")
    else status = authorized (grace_period detected)
        BW->>AL: createPlatformAlert (severity=warning, "Período de gracia")
    else status = cancelled
        BW->>AL: createPlatformAlert (severity=critical, "Suscripción cancelada")
    else status = expired
        BW->>AL: createPlatformAlert (severity=critical, "Suscripción expirada")
    end

    BW-->>API: {handled: true}
    API-->>MP: 200 OK
```

---

## 3b — Alert Type Coverage Matrix

Every webhook event type that creates a platform alert, the alert `type`
used, and whether `metadata.order_id` is present (enabling the "Ver orden →"
deep-link button in the Notifications tab).

| Webhook type | Handler | Alert `type` | `sourceType` | `metadata.order_id` | Deep-link? |
|---|---|---|---|---|---|
| `payment` | `handlePaymentEvent` | `payment` | `mp_payment` | ✅ from `external_reference` | ✅ |
| `point_integration_wh` / `order` | `handlePointIntegrationEvent` | `payment` | `mp_point` | ✅ from `attempt.order_id` | ✅ |
| `mp-connect` (deauth) | `handleMpConnectEvent` | `mp_connect` | `mp_connect` | ❌ account-level | ❌ |
| `claim` | `handleClaimEvent` | `claim` | `mp_claim` | ✅ if attempt found | ✅ conditional |
| `subscription_*` | `handleSubscriptionEvent` | `subscription` | `mp_subscription` | ❌ | ❌ |
| billing webhook | `billingWebhookService` | `subscription` | `mp_billing` | ❌ | ❌ |

### Multiple payments per order

A single order can have **many** payment attempts (retry after rejection,
split payments, etc.). Each webhook creates its own alert row. The alert
title includes the first 8 characters of the `orderId` for scannability:
`"Pago aprobado — orden a1b2c3d4"`. All alerts for the same order share
`metadata.order_id`, so the "Ver orden →" button always opens the correct
order detail panel.

### Alert severity mapping (payment events)

| Sync status | Severity | Rationale |
|---|---|---|
| `approved` | `info` | Normal — payment succeeded |
| `rejected` | `warning` | Actionable — tenant can retry |
| `canceled` | `warning` | Actionable — tenant can start new payment |
| `error` | `critical` | Requires investigation |
| _other_ | `info` | Default — intermediate states |

---

## 4 — Platform Alert Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created : createPlatformAlert()

    Created --> Visible : Rendered in\nNotifications tab\n(read_at IS NULL)

    Visible --> Read : markAlertRead(id)\nor markAllAlertsRead()

    Read --> [*] : Row remains in DB\n(soft-read, never deleted)

    note right of Visible
        Bell badge shows
        unreadCount > 0
        Refetches every 60 s
    end note

    note right of Read
        read_at = NOW()
        Card rendered at 60% opacity
        Badge count decreases
    end note
```

---

## 5 — Alert Deep-Link Navigation

When an alert has `metadata.order_id`, the Notifications tab renders a
**"Ver orden →"** button.  Clicking it:

```mermaid
sequenceDiagram
    participant User
    participant Bell as Bell Button (ProductOrderManagment)
    participant Modal as SettingsModal → Notifications Tab
    participant Router as Next.js Router (nuqs)
    participant POS as Main POS Page

    User->>Bell: click (unread badge visible)
    Bell->>Modal: open with initialTab="notifications"
    Modal->>Modal: render NotificationsTab
    User->>Modal: click "Ver orden →" on alert card
    Modal->>Router: router.push("/?sheet=true&selected=<id>")
    Modal->>Modal: onClose() → Dialog closes
    Router->>POS: navigate, nuqs sets selected param
    POS->>POS: order panel opens for that order
```

---

## 6 — Unread Badge Polling

> **Note:** The 60-second polling is now a **fallback only**.  
> Real-time invalidation is handled via SSE (see section 7 below).  
> The `refetchInterval: 60_000` acts as a safety net in case the SSE
> connection drops or the browser tab was backgrounded.

```mermaid
sequenceDiagram
    participant POM as ProductOrderManagment
    participant TRPC as tRPC alerts.list
    participant DB as platform_alerts

    loop every 60 s (fallback)
        POM->>TRPC: query {unreadOnly: true}
        TRPC->>DB: SELECT count(*) WHERE read_at IS NULL AND tenant_id = :t
        DB-->>TRPC: {alerts: [], unreadCount: N}
        TRPC-->>POM: unreadCount
        POM->>POM: render badge (N > 0 → red circle with count)
    end
```

---

## 7 — SSE Real-Time Invalidation Architecture

### Why the server stays stateless (no client params on `/api/sse`)

The SSE endpoint **does NOT** receive the client's current URL / nuqs params.
This is intentional — the architecture relies on **server-emitted lightweight
events** and **client-side TanStack Query intelligence** to decide what to
refetch.

#### Considered & rejected: `/api/sse?selected=X&date=Y&sheet=true`

| Problem | Detail |
|---------|--------|
| **EventSource is read-only** | The browser `EventSource` API sets URL params **only at connection time**. Every time `?selected` or `?date` changes (nuqs writes to the URL bar), we'd need to **close and reconnect** — killing the event stream and introducing latency spikes. |
| **Multi-tab / multi-user** | Each tab and each user has different params. The server would need per-connection state tracking — session affinity, connection maps, cleanup timers — all for marginal gain. |
| **TanStack Query already filters for free** | `queryClient.invalidateQueries()` only triggers a **network refetch for active queries** (those with a mounted React `useQuery` observer). Inactive/stale cache entries are just marked stale; they refetch lazily when the component using them next mounts. Zero wasted bandwidth. |

#### How it actually works: stateless server, smart client

```mermaid
flowchart TB
    subgraph Server["Server (stateless)"]
        DE[domain_events table] -->|poll every 3 s| SSE["/api/sse endpoint"]
        SSE -->|"event: invalidate\ndata: {table, op, id, cursor}"| ES[EventSource stream]
    end

    subgraph Client["Client (React + TanStack Query)"]
        ES --> Hook["useSSEInvalidation hook"]
        Hook --> Handler["SSEInvalidationListener\n(tRPC-native handlers)"]
        Handler -->|"invalidateQueries(\n  queryKey: trpc.X.Y.queryKey()\n)"| QC["QueryClient"]
        QC -->|"refetch only if\nobserver is mounted"| Active["Active queries\n(visible UI)"]
        QC -.->|"mark stale only"| Idle["Idle queries\n(background cache)"]
    end

    style Active fill:#d4edda,stroke:#28a745
    style Idle fill:#f8d7da,stroke:#dc3545
```

### How nuqs params map to invalidation scope

The user's current view is encoded in URL query params managed by `nuqs`.
Each param feeds into a tRPC query's `input`, which becomes part of the
TanStack Query cache key. The SSE system doesn't need to know these params
because it uses **path-only prefix matching**, and TanStack Query only
refetches queries that have an active observer.

| nuqs param | tRPC query affected | SSE table trigger | Active? |
|------------|--------------------|--------------------|---------|
| `?selected=a,b` | `orders.getDetails({id})` for each | Same as above | ✅ Only the mounted detail |
| `?date=2026-02-24` | `orders.list({date, timeZone, status})` | `orders` | ✅ Always mounted on POS |
| `?sheet=true` | `orders.list(...)` (history sheet) | `orders` | ✅ Only while sheet is open |
| _(none — POS default)_ | `products.list`, `extras.list`, `alerts.list({unreadOnly})` | `products`, `extras`, `platform_alerts` | ✅ Always mounted |

### tRPC v11 query key format & why `TABLE_INVALIDATION_MAP` needed fixing

tRPC v11 (`@trpc/tanstack-react-query`) stores query keys as:

```
[["path", "segment"], { input: {...}, type: "query" }]
 ↑ nested array         ↑ second element
```

`TABLE_INVALIDATION_MAP` originally stored flat string arrays:
```ts
["orders", "list"]  // ← first element is "orders" (string)
```

TanStack Query v5 `partialDeepEqual` compares index by index:
```
filter[0] = "orders"          (string)
stored[0] = ["orders","list"] (array)
→ type mismatch → false → NEVER matches
```

**Fix:** `SSEInvalidationListener` uses `trpc.X.Y.queryKey()` which returns:
```ts
[["orders", "list"]]  // ← type="any", no input → path-only prefix
```

Now `partialDeepEqual` works:
```
filter[0] = ["orders","list"] (array)
stored[0] = ["orders","list"] (array)
→ deep equal → ✓ matches ALL orders.list queries regardless of their input
```

### Surgical order-detail invalidation

For order-related tables, the SSE payload carries `event.id` = the affected
row's `orderId` (parsed from `domain_events.payload`). The handler uses this
to invalidate only the specific detail query, not every prefetched detail:

```ts
// SSEInvalidationListener.tsx
orders: (_, event) => {
  // Bust ALL orders.list variants (every date/status combo)
  queryClient.invalidateQueries({ queryKey: trpc.orders.list.queryKey() });
  // Bust ONLY the specific order detail (if the user has it open)
  if (event.id) {
    queryClient.invalidateQueries({
      queryKey: trpc.orders.getDetails.queryKey({ id: event.id }),
    });
  }
},
```

### Complete table → tRPC query mapping

| SSE `table` | tRPC queries invalidated | Surgical? |
|-------------|--------------------------|-----------|
| `orders` | `orders.list.*`, `orders.getDetails({id})` | ✅ by `event.id` |
| `order_items` | `orders.list.*`, `orders.getDetails({id})` | ✅ by `event.id` |
| `order_item_extras` | `orders.list.*`, `orders.getDetails({id})` | ✅ by `event.id` |
| `products` | `products.list.*`, `products.export.*` | prefix (all) |
| `product_consumptions` | `products.consumptions.list.*` | prefix (all) |
| `extras` | `extras.list.*` | prefix (all) |
| `inventory_items` | `inventory.items.list.*`, `inventory.items.lowStock.*` | prefix (all) |
| `categories` | `inventory.categories.list.*` | prefix (all) |
| `transactions` | `inventory.transactions.list.*`, `.dailyGastos.*`, `.byDate.*` | prefix (all) |
| `platform_alerts` | `alerts.list.*`, `alerts.adminList.*` | prefix (all) |

### Complete domain event → SSE table routing

| Domain event | SSE tables | Notes |
|--------------|-----------|-------|
| `order.created` | `orders` | |
| `order.item.updated` | `orders`, `order_items` | |
| `order.split` | `orders`, `order_items` | |
| `order.combined` | `orders`, `order_items` | |
| `order.closed` | `orders` | |
| `order.opened` | `orders` | |
| `order.payment.toggled` | `orders`, `order_items` | Summary totals change |
| `order.payment.set` | `orders`, `order_items` | Batch payment assignment |
| `order.takeaway.toggled` | `orders`, `order_items` | |
| `order.products.removed` | `orders`, `order_items` | |
| `order.batch.closed` | `orders`, `order_items` | End-of-day close |
| `product.upserted` | `products` | |
| `product.consumption.added` | `product_consumptions` | Ingredient links |
| `product.consumption.removed` | `product_consumptions` | |
| `extra.upserted` | `extras` | |
| `extra.deleted` | `extras` | |
| `order.item.extra.toggled` | `order_item_extras` | |
| `inventory.item.added` | `inventory_items` | |
| `inventory.item.toggled` | `inventory_items` | |
| `inventory.item.deleted` | `inventory_items` | |
| `inventory.transaction.upserted` | `transactions` | |
| `inventory.transaction.deleted` | `transactions` | |
| `inventory.eod.reconciled` | `inventory_items`, `transactions` | Cross-table |
| `inventory.category.upserted` | `categories` | |
| `inventory.category.deleted` | `categories` | |
| `inventory.category.item.toggled` | `categories`, `inventory_items` | |
| `platform_alert.created` | `platform_alerts` | |

### Intentionally excluded from SSE

These event types emit domain_events but do **not** need SSE-triggered
client refreshes (they are admin-only, session-scoped, or have their own
refresh mechanism):

| Domain event | Reason |
|--------------|--------|
| `admin.audit.logged` | Admin audit trail — not user-facing |
| `order.payment.mercadopago.start` | MP payment modal has its own `attempt` polling query |
| `mercadopago.credentials.upserted` | Settings screen refetches on mutation `onSuccess` |

### Event flow end-to-end (example: new order created)

```mermaid
sequenceDiagram
    autonumber
    participant U1 as User A (creator)
    participant API as tRPC mutation
    participant DE as domain_events
    participant SSE as /api/sse (3s poll)
    participant U2 as User B (POS open)
    participant TQ as TanStack QueryClient

    U1->>API: orders.create({productId, timeZone})
    API->>DE: INSERT domain_events (event_type='order.created')
    API-->>U1: optimistic update (immediate local UI)
    Note over SSE: next poll cycle (≤3s)
    SSE->>DE: SELECT WHERE id > cursor AND status='processed'
    DE-->>SSE: [{event_type:'order.created', payload:{orderId:'xyz'}}]
    SSE->>U2: event: invalidate\ndata: {table:'orders', id:'xyz'}
    U2->>TQ: handler → invalidateQueries(trpc.orders.list.queryKey())
    TQ->>TQ: orders.list has active observer? → YES → refetch
    TQ-->>U2: fresh order list appears (includes new order)
```
