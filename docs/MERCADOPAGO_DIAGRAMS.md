# MercadoPago Integration — Visual Diagrams

> **Tip:** GitHub renders Mermaid natively. In VS Code install the "Markdown Preview Mermaid Support" extension.

See also:

- [Mercado Pago Platform + Tenant Architecture](./MERCADOPAGO_PLATFORM_TENANT_ARCHITECTURE.md)
- [MercadoPago OAuth Integration](./MERCADOPAGO_OAUTH.md)
- [Entitlement Architecture](./MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md)
- [Approach — Payment & Billing](./MERCADOPAGO_APPROACH.md)
- [Planned Process (Visual Guide)](./MERCADOPAGO_PLANNED_PROCESS.md)

## Mercado Pago Docs Retrieval Convention

For external Mercado Pago documentation references used by this project, prefer markdown-compatible URLs by appending `.md` to the docs path.

- Default format: `https://www.mercadopago.com.br/developers/pt/docs/<topic>.md`
- Fallback format: original HTML docs URL when `.md` is not available.

Examples:

- `https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/create-application.md`
- `https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration.md`

---

## 0. Two-App Architecture Overview

The platform uses **two independent MercadoPago applications** with separate credentials, webhook URLs, and purposes. Tenant payments (App 1) are gated by an active billing subscription (App 2).

```mermaid
flowchart TB
    subgraph app1["App 1 — MP-Point (2318642168506769)"]
        direction TB
        A1_PURPOSE["Purpose: Tenant collects<br/>in-person payments from<br/>their customers"]
        A1_CREDS["Credentials:<br/>MP_CLIENT_ID<br/>MP_CLIENT_SECRET"]
        A1_WH["Webhook URL:<br/>/api/mercadopago/webhook"]
        A1_EVENTS["Events: payment,<br/>point_integration_wh,<br/>mp-connect, order"]
        A1_OAUTH["OAuth per tenant → per-tenant<br/>access_token + user_id"]
    end

    subgraph app2["App 2 — Billing (6186158011206269)"]
        direction TB
        A2_PURPOSE["Purpose: Platform charges<br/>tenants a subscription fee<br/>to unlock MP features"]
        A2_CREDS["Credentials:<br/>MP_BILLING_CLIENT_ID<br/>MP_BILLING_CLIENT_SECRET"]
        A2_WH["Webhook URL:<br/>/api/billing/mercadopago/webhook"]
        A2_EVENTS["Events: subscription_preapproval,<br/>subscription_authorized_payment,<br/>payment, mp-connect"]
    end

    subgraph chain["Dependency Chain"]
        direction LR
        SUB["Tenant subscribes<br/>(App 2)"]
        ENT["Entitlement<br/>becomes active"]
        OAUTH["Tenant connects<br/>OAuth (App 1)"]
        PROV["Store + POS<br/>auto-provisioned"]
        PAY["Tenant can charge<br/>customers (QR/PDV)"]
        SUB --> ENT --> OAUTH --> PROV --> PAY
    end

    app2 -.->|"subscription webhook<br/>activates entitlement"| chain
    app1 -.->|"OAuth callback<br/>triggers auto-provision"| chain

    style app1 fill:#eff6ff,stroke:#3b82f6
    style app2 fill:#faf5ff,stroke:#8b5cf6
    style chain fill:#f0fdf4,stroke:#22c55e
```

### Credential Isolation

| | App 1 (Point — Payments) | App 2 (Billing — Subscriptions) |
|---|---|---|
| **MP App ID** | `2318642168506769` | `6186158011206269` |
| **Purpose** | Tenant charges their customers | Platform charges tenants |
| **Credential type** | OAuth per-tenant (`access_token`) | Platform-level (`MP_BILLING_*`) |
| **Webhook URL** | `/api/mercadopago/webhook` | `/api/billing/mercadopago/webhook` |
| **Webhook secret** | `MP_WEBHOOK_SECRET` | `MP_BILLING_WEBHOOK_SECRET` |
| **Key events** | `payment`, `point_integration_wh`, `mp-connect` | `subscription_preapproval`, `subscription_authorized_payment` |
| **Auto-provisioning** | Store + POS created on OAuth connect | N/A |

---

## 1. Environment Variables — What Each Secret Does

```mermaid
flowchart LR
    subgraph dashboard["MP Developer Dashboard"]
        CID["Client ID\n(MP_CLIENT_ID)"]
        CS["Client Secret\n(MP_CLIENT_SECRET)"]
        PK["Public Key\n❌ NOT NEEDED"]
        AT["App Access Token\n❌ NOT NEEDED"]
        WS["Webhook Secret\n(MP_WEBHOOK_SECRET)"]
    end

    subgraph oauth["OAuth Flow"]
        AUTH["POST /oauth/token"]
    end

    subgraph whval["Webhook Validation"]
        HMAC["x-signature HMAC check"]
    end

    subgraph tenant["Per-Tenant (from OAuth)"]
        TAT["Tenant access_token\n(stored in DB)"]
    end

    subgraph api["API Calls"]
        PAY["QR / PDV payments"]
        USERS["GET /users/me"]
    end

    CID -->|identifies your app| AUTH
    CS -->|proves you own the app| AUTH
    AUTH -->|returns per-tenant| TAT
    TAT -->|Bearer token| PAY
    TAT -->|Bearer token| USERS
    WS -->|validates incoming| HMAC

    style PK fill:#fee,stroke:#c33,color:#c33
    style AT fill:#fee,stroke:#c33,color:#c33
```

**Summary:**

| Env var | Source | Purpose |
|---------|--------|---------|
| `MP_CLIENT_ID` | MP dashboard → Your App | Identifies your app during OAuth |
| `MP_CLIENT_SECRET` | MP dashboard → Your App | Proves app ownership during code→token exchange |
| `MP_WEBHOOK_SECRET` | MP dashboard → Webhooks config | Validates `x-signature` HMAC on incoming webhooks |
| `MP_REDIRECT_URI` | You define it | Shared path for OAuth callback + webhook (`/api/mercadopago/webhook`) |
| `MP_REDIRECT_TEST_URI` | You define it | Sandbox/test webhook path (`/api/mercadopago/webhook/test`) |
| Public Key | MP dashboard | ❌ Only for client-side JS SDK — **not needed** |
| App Access Token | MP dashboard | ❌ Per-tenant tokens come from OAuth — **not needed** |

---

## 2. OAuth Flow — Tenant Onboarding

```mermaid
sequenceDiagram
    participant T as Tenant Manager
    participant App as orders_managment
    participant MP as MercadoPago

    Note over T,MP: ENV: MP_CLIENT_ID + MP_CLIENT_SECRET

    T->>App: 1. Fill contact email + click Conectar
    activate App
    App->>App: Generate CSRF state
    App->>App: Set cookies (state, tenant_id, email)
    App-->>T: 302 → MercadoPago authorize URL
    deactivate App

    T->>MP: 2. User authorizes the app
    activate MP
    MP-->>T: 302 → /api/mercadopago/oauth/callback?code&state
    deactivate MP

    T->>App: 3. GET /callback?code&state
    activate App
    App->>App: Validate state cookie (CSRF)
    App->>MP: POST /oauth/token (client_id + client_secret + code)
    activate MP
    MP-->>App: access_token + user_id + refresh_token
    deactivate MP
    App->>MP: GET /users/me (Bearer access_token)
    activate MP
    MP-->>App: id + email + nickname
    deactivate MP
    App->>App: upsertCredentials(tenant, token, user_id, email)
    App->>App: completeAccessRequest(tenant)
    App-->>T: 302 → /?mp_oauth=success
    deactivate App

    Note over App: DB: mercadopago_credentials stored
```

**Key points:**
- `MP_CLIENT_SECRET` is used **once** — server-side POST to `/oauth/token`
- Each tenant gets their **own** `access_token` — stored in `mercadopago_credentials`
- `user_id` (MP account ID) is how we link webhooks back to the tenant later

---

## 3. Webhook Pipeline — Tenant Resolution & Event Routing

```mermaid
flowchart TD
    MP["MercadoPago sends POST\n+ x-signature header"] --> WH["POST /api/mercadopago/webhook"]

    WH --> SIG{"MP_WEBHOOK_SECRET\nset in env?"}
    SIG -->|Yes| VAL["Validate x-signature\nHMAC-SHA256"]
    SIG -->|"No (dev only)"| SKIP["Skip validation"]
    VAL -->|Invalid| R401["❌ 401 Invalid signature"]
    VAL -->|Valid| RESOLVE
    SKIP --> RESOLVE

    RESOLVE["resolveWebhookTenant()"] --> Q1["SELECT FROM mercadopago_credentials\nWHERE user_id = notification.user_id\nAND status = active"]
    Q1 -->|Found| ROUTE
    Q1 -->|Not found| Q2["Fallback: match by contact_email"]
    Q2 -->|Found| ROUTE
    Q2 -->|Not found| R200W["⚠️ 200 OK + log warning\nno matching tenant"]

    ROUTE{"Route by\nnotification.type"} -->|payment| PAY["handlePaymentEvent()"]
    ROUTE -->|point_integration_wh| POINT["handlePointEvent()"]
    ROUTE -->|mp-connect| CONN["handleMpConnectEvent()"]
    ROUTE -->|anything else| ACK["✅ 200 OK acknowledged"]

    PAY --> FPAY["GET /v1/payments/:id\nusing tenant access_token"]
    FPAY --> MPAY["Map MP status → sync status\napproved/rejected/canceled/error"]
    MPAY --> UPAY["UPDATE payment_sync_attempts\nby external_reference = orderId"]
    UPAY --> R200["✅ 200 OK"]

    POINT --> PMAP["Map action → status\nstate_FINISHED → approved\nstate_CANCELED → canceled\nstate_ERROR → error"]
    PMAP --> UPNT["UPDATE payment_sync_attempts\nby mp_transaction_id"]
    UPNT --> R200

    CONN --> DAUTH{"action =\ndeauthorized?"}
    DAUTH -->|Yes| INACT["SET credentials\nstatus = inactive"]
    DAUTH -->|No| LOG["Log action"]
    INACT --> R200
    LOG --> R200
```

**Tenant resolution chain:**
1. Primary: `mercadopago_credentials.user_id` = `notification.user_id` (MP account owner)
2. Fallback: `mercadopago_credentials.contact_email` (human-readable secondary match)
3. No match: Return 200 anyway (prevent infinite MP retries) + log warning

---

## 4. Payment Flow — QR / PDV End-to-End

```mermaid
sequenceDiagram
    participant M as Manager UI
    participant tRPC as tRPC Router
    participant H as Event Handler
    participant MP as MercadoPago API
    participant WH as Webhook Endpoint
    participant DB as payment_sync_attempts

    M->>tRPC: payment.start(orderId, flow: pdv)
    activate tRPC
    tRPC->>tRPC: Verify credentials exist + order is closed
    tRPC->>H: dispatchDomainEvent(order.payment.mercadopago.start)
    activate H

    H->>DB: createAttempt → status: pending
    H->>DB: updateAttempt → status: processing

    alt QR Flow
        H->>MP: POST /instore/orders/qr/...
        MP-->>H: qr_data + in_store_order_id
        H->>DB: updateAttempt(qr_code, mp_txn_id) → pending
        H-->>tRPC: attemptId + qrCode
        tRPC-->>M: Show QR to customer
    else PDV Flow (Point Terminal)
        H->>MP: GET /terminals/v1/list → pick first device
        H->>MP: POST /point/.../payment-intents
        MP-->>H: intent id + state
        H->>DB: updateAttempt(terminal_id, mp_txn_id) → processing
        H-->>tRPC: attemptId + terminalId
        tRPC-->>M: Sent to terminal
    end
    deactivate H
    deactivate tRPC

    Note over MP,WH: Customer pays on terminal or scans QR...

    MP->>WH: POST /api/mercadopago/webhook
    activate WH
    WH->>WH: Validate x-signature (MP_WEBHOOK_SECRET)
    WH->>WH: resolveWebhookTenant(user_id)

    alt type: payment
        WH->>MP: GET /v1/payments/:id
        MP-->>WH: status: approved, external_reference: orderId
        WH->>DB: updateAttempt → status: approved
    else type: point_integration_wh
        Note over WH: action: state_FINISHED
        WH->>DB: updateAttempt by mp_transaction_id → approved
    end
    WH-->>MP: 200 OK
    deactivate WH

    M->>tRPC: payment.status(orderId)
    tRPC->>DB: getLatestAttempt
    DB-->>tRPC: status: approved
    tRPC-->>M: Payment confirmed
```

---

## 5. Payment Sync Attempt — State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: createAttempt()

    pending --> processing: MP API call sent
    processing --> approved: payment.status=approved\nor state_FINISHED
    processing --> rejected: payment.status=rejected
    processing --> canceled: state_CANCELED\nor user cancels
    processing --> error: state_ERROR\nor API failure

    pending --> approved: QR scanned + paid
    pending --> canceled: user cancels
    pending --> error: timeout / failure

    approved --> [*]
    rejected --> [*]
    canceled --> [*]
    error --> [*]

    note right of approved: Terminal status
    note right of rejected: Terminal status
    note right of canceled: Terminal status
    note right of error: Terminal status
```

---

## 6. Auto-Provisioning — Store + POS on OAuth Connect

When a tenant completes OAuth, the `mercadopago.credentials.upserted` event handler
automatically creates a Store and POS for the tenant on the MP API. This is a
homologation requirement — QR flow depends on a pre-registered POS with a valid
`external_pos_id`.

```mermaid
sequenceDiagram
    participant T as Tenant
    participant App as OAuth Callback
    participant H as Event Handler
    participant MP as MercadoPago API
    participant DB as Database

    T->>App: Complete OAuth authorization
    App->>DB: upsertCredentials(tenant, token, user_id)
    App->>H: emit(mercadopago.credentials.upserted)
    activate H

    Note over H: Auto-provision (best-effort)

    H->>MP: POST /users/{user_id}/stores
    MP-->>H: { id: store_id }
    H->>MP: POST /pos { store_id, external_id }
    MP-->>H: { id: pos_id }
    H-->>App: ✅ Store + POS created
    deactivate H

    Note over H: If either call fails:<br/>logged as warning,<br/>does not block OAuth

    App-->>T: 302 → /?mp_oauth=success
```

---

## 7. Billing Webhook Pipeline

Platform subscription events from App 2 (Billing) are handled on a separate
endpoint with independent HMAC validation.

```mermaid
flowchart TD
    MP2["MercadoPago Billing App\n(6186158011206269)"] --> BWH["POST /api/billing/mercadopago/webhook"]

    BWH --> BSIG{"MP_BILLING_WEBHOOK_SECRET\nset in env?"}
    BSIG -->|Yes| BVAL["Validate x-signature\nHMAC-SHA256"]
    BSIG -->|"No (dev only)"| BSKIP["Skip validation"]
    BVAL -->|Invalid| BR401["❌ 401 Invalid signature"]
    BVAL -->|Valid| BROUTE
    BSKIP --> BROUTE

    BROUTE{"Route by\nevent type"} -->|subscription_preapproval| BSUB["processBillingEvent()"]
    BROUTE -->|subscription_authorized_payment| BPAY["processBillingEvent()"]
    BROUTE -->|payment| BPMT["processBillingEvent()"]
    BROUTE -->|other| BACK["✅ 200 OK acknowledged"]

    BSUB --> BENT["Update tenant_subscriptions\n→ recompute tenant_entitlements"]
    BPAY --> BENT
    BPMT --> BENT
    BENT --> BAUD["Write tenant_billing_events\n(audit)"]
    BAUD --> BR200["✅ 200 OK"]

    style MP2 fill:#faf5ff,stroke:#8b5cf6
    style BWH fill:#faf5ff,stroke:#8b5cf6
```

---

## File Map

```
app/api/mercadopago/
├── oauth/
│   ├── authorize/route.ts   ← Initiates OAuth (uses MP_CLIENT_ID)
│   └── callback/route.ts    ← Handles callback (uses MP_CLIENT_SECRET)
├── webhook/
│   ├── route.ts             ← Production webhooks (uses MP_WEBHOOK_SECRET)
│   └── test/route.ts        ← Sandbox webhooks (no signature check)

app/api/billing/mercadopago/
└── webhook/
    ├── route.ts             ← Billing webhooks (uses MP_BILLING_WEBHOOK_SECRET)
    └── test/route.ts        ← Billing sandbox webhooks

lib/services/mercadopago/
├── mpFetch.ts               ← Shared HTTP helper (Bearer auth, B4 headers)
├── oauthService.ts          ← OAuth helpers (authorize URL, token exchange)
├── credentialsService.ts    ← CRUD mercadopago_credentials table
├── accessRequestsService.ts ← Track pending OAuth access requests
├── paymentService.ts        ← MP API: QR + PDV payment intents + device mode
├── storeService.ts          ← Store/Branch CRUD (homologation A1)
├── posService.ts            ← POS CRUD (homologation A2)
├── refundService.ts         ← Full + partial refund API
├── statusService.ts         ← CRUD payment_sync_attempts table
├── webhookService.ts        ← Webhook: signature, tenant resolver, handlers
└── tokenCrypto.ts           ← AES-256-GCM token encryption at rest

lib/events/
├── contracts.ts             ← Domain event types (incl. store, pos, refund, device)
└── handlers.ts              ← Event handlers (incl. auto-provision Store+POS)
```
