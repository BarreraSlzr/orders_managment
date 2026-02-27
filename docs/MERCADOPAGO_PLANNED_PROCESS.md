# Mercado Pago — Planned Process (Visual Guide)

This document explains the **planned target flow** in a visual-first way.

Scope covered:
- Manager journey from tenant session
- Subscription-first entitlement gating
- OAuth connect after entitlement activation
- Webhook-driven lifecycle updates
- Integration-only fallback behavior before business-layer data exists

---

## 1) Big Picture — What happens first

```mermaid
flowchart TD
    A[Manager opens Settings in tenant session] --> B[See MP status and quality]
    B --> C{Has active entitlement?}

    C -- No --> D[Enter/confirm contact email hint]
    D --> E[Create billing subscription\nApp 2 Billing]
    E --> F[Billing webhook events\nupdate subscription status]
    F --> G{Subscription approved?}
    G -- No --> H[Keep blocked for OAuth\nshow pending or failed status]
    G -- Yes --> I[Activate tenant entitlement]

    C -- Yes --> J[Enable Connect Mercado Pago action]
    I --> J

    J --> K[OAuth connect\nApp 1 Point]
    K --> L[Store tenant tokens and MP user_id]
    L --> M[Enable payment sync and reconciliation]

    H --> B
    M --> B
```

---

## 2) User Journey — Manager perspective

```mermaid
journey
    title Tenant manager activation path
    section Subscription gate
      Open Settings modal: 5: Manager
      Review MP health/quality: 4: Manager
      Add contact email hint: 4: Manager
      Start subscription checkout: 5: Manager
      Wait for approval confirmation: 3: Manager
    section OAuth and operations
      Connect Mercado Pago account: 5: Manager
      Return to app after OAuth callback: 4: Manager
      Validate integration status: 4: Manager
      Start collecting and reconciling payments: 5: Manager
```

---

## 3) State Model — Tenant MP activation lifecycle

```mermaid
stateDiagram-v2
    [*] --> NotConfigured

    NotConfigured --> BillingPending: subscription created
    BillingPending --> BillingActive: billing webhook approved
    BillingPending --> BillingFailed: billing webhook rejected/canceled
    BillingFailed --> BillingPending: retry subscription

    BillingActive --> OAuthPending: show connect CTA
    OAuthPending --> OAuthConnected: oauth callback success
    OAuthPending --> OAuthFailed: oauth denied/error
    OAuthFailed --> OAuthPending: retry oauth

    OAuthConnected --> Operational: token valid + user linked
    Operational --> Degraded: token invalid / deauthorized / mismatch
    Degraded --> OAuthPending: reconnect oauth

    BillingActive --> [*]
    Operational --> [*]
```

---

## 4) Sequence — Subscription first, then OAuth

```mermaid
sequenceDiagram
    participant Manager as Tenant Manager
    participant UI as Settings UI
    participant API as App API
    participant MPB as Mercado Pago Billing (App 2)
    participant WHB as Billing Webhook
    participant DB as Platform DB
    participant MPP as Mercado Pago Point (App 1)

    Manager->>UI: Open Settings / Mercado Pago section
    UI->>API: Get MP status + entitlement + quality
    API-->>UI: Current status

    alt No active entitlement
        Manager->>UI: Enter contact email hint
        UI->>API: Create billing subscription
        API->>MPB: POST preapproval / plan
        MPB-->>API: init_point + subscription_id
        API-->>UI: Redirect URL / pending state

        MPB-->>WHB: subscription_preapproval notification
        WHB->>DB: Update tenant subscription state
        WHB->>DB: Activate entitlement when approved
        DB-->>UI: status available for refresh/SSE
    end

    UI->>API: Check entitlement again
    API-->>UI: Entitlement active

    Manager->>UI: Click Connect Mercado Pago
    UI->>MPP: OAuth authorize
    MPP-->>API: OAuth callback with code
    API->>MPP: Exchange code for token
    API->>DB: Save tenant credentials + user_id
    API-->>UI: Connected

    UI->>API: Start payment sync/reconciliation features
```

---

## 5) Webhook decisions — expected behavior

```mermaid
flowchart TD
    W0[Webhook received] --> W1{Source app?}

    W1 -->|Billing App 2| B1[Validate signature]
    B1 --> B2{Topic}
    B2 -->|subscription_preapproval| B3[Update subscription state]
    B3 --> B4{Approved?}
    B4 -->|Yes| B5[Set entitlement active]
    B4 -->|No| B6[Keep pending or failed]

    W1 -->|Point App 1| P1[Validate signature]
    P1 --> P2[Resolve tenant from user_id/email fallback]
    P2 --> P3{Tenant resolved?}
    P3 -->|No| P4[Return 200 + alert\nunknown mapping]
    P3 -->|Yes| P5{Business-layer record exists?}
    P5 -->|No| P6[Return 200 integration-only acknowledged]
    P5 -->|Yes| P7[Apply payment/order sync update]

    B5 --> DONE[Return 200]
    B6 --> DONE
    P4 --> DONE
    P6 --> DONE
    P7 --> DONE
```

---

## 6) Implementation checkpoints (planned)

1. **Settings first**: show status/quality and required email hint UX in tenant session.
2. **Subscription gate**: block OAuth until entitlement becomes active.
3. **Webhook source of truth**: entitlement activation only from approved billing webhook state.
4. **OAuth after entitlement**: connect Point app and persist tenant credentials.
5. **Operational resilience**: continue returning `200` for integration-only Point events while alerting unresolved tenant mappings.

---

## 7) Public availability requirement (production + test)

For Mercado Pago “situation/quality” and webhook processing to work as expected in production stage:

- Both MP apps must point to **public HTTPS** webhook URLs.
- Both environments must be reachable from Mercado Pago infrastructure:
    - production callback (`callback`)
    - test/sandbox callback (`callback_sandbox`)
- Test routes are not optional during hardening; they must also be publicly reachable for reliable simulation and validation.

```mermaid
flowchart LR
        MP[Mercado Pago platform] --> P1[App 1 Point webhook URL\npublic HTTPS]
        MP --> P2[App 2 Billing webhook URL\npublic HTTPS]
        MP --> T1[App 1 test webhook URL\npublic HTTPS]
        MP --> T2[App 2 test webhook URL\npublic HTTPS]

        P1 --> O1[Payment / order / point events processed]
        P2 --> O2[Subscription events processed]
        T1 --> O3[Simulation and pre-prod validation]
        T2 --> O4[Simulation and pre-prod validation]

        O1 --> Q[MP situation/quality reflects real integration health]
        O2 --> Q
        O3 --> Q
        O4 --> Q
```

### Availability checklist

| Integration | Production webhook (public) | Test webhook (public) | Required for MP health |
|---|---|---|---|
| App 1 — Point | ✅ Required | ✅ Required | ✅ Yes |
| App 2 — Billing | ✅ Required | ✅ Required | ✅ Yes |

If any of these four endpoints is private, blocked, or not routable, Mercado Pago validation/simulations become inconsistent and production-readiness is not guaranteed.

---

## Notes

- Billing ownership is system/platform-level, while activation is applied to the tenant entitlement lifecycle.
- Tenant manager flow remains tenant-session based for UX and status visibility.
- The diagrams represent target behavior for rollout validation and hardening.
