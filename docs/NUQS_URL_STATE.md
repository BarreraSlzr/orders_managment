# nuqs URL State Guide

This document explains every current nuqs-based query parameter in the app, where it is defined, and why it exists.

## Why we use nuqs

- Deep-linkable UI state: a URL can open the exact screen state without manual clicks.
- Deterministic E2E tests: tests can navigate directly to state instead of relying on slow gestures.
- Shareable debugging links: team members can reproduce the same UI state from one URL.
- Single source of truth: URL state reduces duplicated local state across components.
- Better refresh behavior: key UI context survives reloads and navigation.

## Canonical query params

### 1) selected

- Defined in [hooks/useOrders.tsx](hooks/useOrders.tsx) and [hooks/useProducts.tsx](hooks/useProducts.tsx).
- Parser: `parseAsArrayOf(parseAsString).withDefault([])`.
- Purpose: shared selection state for orders and products.

Behavior:

- `?selected=<orderId>` opens order details (single selection).
- `?selected=id1,id2` enables multi-select in orders.
- `?selected=<productId>` opens product edit form (if id exists in products map).
- `?selected=new` opens product create form.

Why this design:

- One param for both domains avoids duplicated URL state and test helpers.
- Type resolution is done by ownership map (orders vs products), so tests can use one pattern.

### 2) sheet

- Defined in [components/sheets/Orders.tsx](components/sheets/Orders.tsx).
- Parser: `parseAsString.withDefault("")`.
- Purpose: open/close Order Sheet and select sheet tab via URL.

Behavior:

- `?sheet=true` opens sheet on default tab (opened orders).
- `?sheet=closed` opens sheet on closed tab.
- `?sheet=all` opens sheet on all tab.
- Empty or `false` closes sheet.

Why this design:

- A single param controls both visibility and tab state.
- Direct tab navigation is critical for E2E speed and repeatability.

### 3) date

- Defined in [components/sheets/Orders.tsx](components/sheets/Orders.tsx).
- Parser: `parseAsString.withDefault(today)` where today is timezone-aware (`America/Mexico_City`).
- Purpose: date-scoped orders and summary state.

Behavior:

- `?date=YYYY-MM-DD` filters order queries and summary for that day.

Why this design:

- Shareable day views for operations and debugging.
- Prevents hidden local-state drift when switching dates.

### 4) settings

- Defined in [components/ProductOrderManagment.tsx](components/ProductOrderManagment.tsx).
- Parser: `parseAsString.withDefault("")`.
- Purpose: open/close Settings modal and choose initial tab.

Behavior:

- `?settings=true` opens modal on default tab.
- `?settings=<tabName>` opens modal on that tab (for example notifications).
- Empty or `false` closes modal.

Why this design:

- Single elegant param instead of separate open + tab params.
- Supports direct E2E navigation to notifications and admin flows.

### 5) filters

- Defined in [components/sheets/Tags.tsx](components/sheets/Tags.tsx).
- Parser: `parseAsBoolean.withDefault(false)`.
- Purpose: open/close the product filter sheet.

Behavior:

- `?filters=true` opens filter sheet.

Why this design:

- Fast test/setup for search/filter scenarios.
- Easier support/debug reproduction for filtering issues.

## E2E mapping

Primary E2E specs use nuqs-based direct navigation:

- [tests/e2e/orderSheet.spec.ts](tests/e2e/orderSheet.spec.ts)
- [tests/e2e/productForm.spec.ts](tests/e2e/productForm.spec.ts)
- [tests/e2e/settingsAlerts.spec.ts](tests/e2e/settingsAlerts.spec.ts)

This is the key reason tests are stable and fast: they avoid long-press and deep UI traversal when the behavior under test is not the gesture itself.

## Conventions for new params

- Prefer one semantic key over multiple coupled keys.
- Keep value vocabulary explicit (`true`, domain values like `closed`, and empty for closed state).
- Use parser defaults (`withDefault`) to avoid undefined branch complexity.
- Document every new query param in this file and in Playwright comments if used in E2E.
