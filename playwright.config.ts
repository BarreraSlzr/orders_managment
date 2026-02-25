import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for e2e tests covering critical user paths:
 * - OrderSheet open/close (URL-driven via nuqs)
 * - Order actions (toggle payment, closeorder, remove items)
 * - Product form (create, edit, delete via unified 'selected' param)
 * - Settings modal with tabs (URL-driven)
 * - Filters sheet (URL-driven)
 * - Stale-data regression path
 *
 * Unified URL params (nuqs) for E2E testing:
 *   ?sheet=true               - Opens order sheet (default: abiertas tab)
 *   ?sheet=closed             - Opens order sheet on cerradas tab
 *   ?sheet=all                - Opens order sheet on todas tab
 *   ?selected=<orderId>       - Selects order (system detects it's an order)
 *   ?selected=<productId>     - Opens product editor (system detects it's a product)
 *   ?selected=new             - Opens create product form
 *   ?settings=true            - Opens settings modal (default tab)
 *   ?settings=<tab>           - Opens settings on specific tab (notifications|csv|export|settings)
 *   ?filters=true             - Opens product filters/search sheet
 *   ?date=<YYYY-MM-DD>        - Filters orders by date
 *
 * Examples:
 *   /?sheet=true&selected=order_123    - Open sheet (abiertas) with order selected
 *   /?sheet=closed                     - Open sheet on cerradas tab
 *   /?sheet=all                        - Open sheet on todas tab
 *   /?selected=prod_456                - Open product editor
 *   /?settings=notifications           - Open settings on notifications tab
 *   /?settings=true                    - Open settings on default tab
 *   /?filters=true                     - Open filters sheet
 *   /?sheet=true&date=2026-02-25       - Open sheet with date filter
 *
 * Run with: bunx playwright test
 * Run a specific file: bunx playwright test tests/e2e/orderSheet.spec.ts
 * Show report: bunx playwright show-report
 *
 * Required setup:
 *   - Dev server running on http://localhost:3000
 *   - ADMIN_SHARED_API_KEY set in .env.local
 *   - Superadmin account: tenant=system, user=superadmin, pass=superadmin
 *     (Override with E2E_TENANT, E2E_USERNAME, E2E_PASSWORD env vars)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Fail fast in CI; continue locally for full feedback
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    /** The dev server must be running before e2e tests */
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
