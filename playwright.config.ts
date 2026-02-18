import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for e2e tests covering critical user paths:
 * - OrderSheet open/close (URL-driven via nuqs)
 * - Order actions (toggle payment, closeorder, remove items)
 * - Stale-data regression path
 *
 * Run with: bunx playwright test
 * Run a specific file: bunx playwright test tests/e2e/orderSheet.spec.ts
 * Show report: bunx playwright show-report
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
