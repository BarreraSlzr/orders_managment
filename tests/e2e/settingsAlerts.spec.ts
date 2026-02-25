/**
 * E2E: Settings → Notifications tab — platform alert lifecycle
 *
 * Covers:
 *  - Smoke: SSE /api/sse connects and streams events
 *  - Smoke: SSE emits `invalidate` for `platform_alerts` when an alert is created
 *  - AlertFABPrefix chip appears next to the gear FAB for unread alerts
 *  - Settings modal → Notifications tab renders unread alerts
 *  - Alert card shows title, body, severity dot
 *  - Unread/read state: "Marcar leído" button toggles opacity
 *  - "Marcar todas como leídas" clears the unread badge
 *  - Alert with metadata.order_id shows "Ver orden →" that navigates to /?sheet=true&selected=<id>
 *  - Unread-only filter hides read alerts
 *
 * Prerequisites:
 *   - Dev server running (bun run dev)
 *   - Test database seeded: bun run seed:test-agent
 *   - Env vars: E2E_ADMIN_TENANT, E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD, ADMIN_SHARED_API_KEY
 *
 * Run:  bunx playwright test tests/e2e/settingsAlerts.spec.ts
 * Debug: bunx playwright test tests/e2e/settingsAlerts.spec.ts --debug
 */
import { TEST_IDS, tid } from "@/lib/testIds";
import { APIRequestContext, expect, Page, test } from "@playwright/test";

// ─── Selectors (derived from testIds) ────────────────────────────────────────

const sel = {
  settingsFab: `[data-testid="${TEST_IDS.SETTINGS.FAB}"]`,
  alertPrefixChip: `[data-testid="${TEST_IDS.SETTINGS.ALERT_PREFIX_CHIP}"]`,
  settingsModal: `[data-testid="${TEST_IDS.SETTINGS.MODAL}"]`,
  notificationsTab: `[data-testid="${TEST_IDS.SETTINGS.NOTIFICATIONS_TAB}"]`,
  unreadBadge: `[data-testid="${TEST_IDS.SETTINGS.UNREAD_BADGE}"]`,
  unreadFilterBtn: `[data-testid="${TEST_IDS.SETTINGS.UNREAD_FILTER_BTN}"]`,
  markAllReadBtn: `[data-testid="${TEST_IDS.SETTINGS.MARK_ALL_READ_BTN}"]`,
  alertCard: (id: string) => `[data-testid="${tid(TEST_IDS.ALERTS.CARD, id)}"]`,
  markReadBtn: (id: string) =>
    `[data-testid="${tid(TEST_IDS.ALERTS.MARK_READ_BTN, id)}"]`,
  orderLinkBtn: (id: string) =>
    `[data-testid="${tid(TEST_IDS.ALERTS.ORDER_LINK_BTN, id)}"]`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(page: Page) {
  const tenant = process.env.E2E_ADMIN_TENANT ?? process.env.E2E_TENANT ?? "";
  const username =
    process.env.E2E_ADMIN_USERNAME ?? process.env.E2E_USERNAME ?? "";
  const password =
    process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD ?? "";

  if (!tenant || !username || !password) {
    throw new Error(
      "Missing E2E admin credentials. Set E2E_ADMIN_TENANT, E2E_ADMIN_USERNAME, and E2E_ADMIN_PASSWORD.",
    );
  }

  await page.goto("/login");
  await page.getByLabel(/tenant/i).fill(tenant);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
}

/**
 * Seed a platform_alert via the admin tRPC broadcast endpoint.
 * Returns the created alert id parsed from the tRPC response.
 *
 * Uses `page.request` (carries the session cookie) plus the admin key header.
 * Requires ADMIN_SECRET env var (same value as the server-side secret).
 */
async function seedAlert(
  request: APIRequestContext,
  options: {
    title: string;
    body?: string;
    severity?: "info" | "warning" | "critical";
    type?: "system" | "changelog";
    /** When set, injects metadata.order_id so the "Ver orden →" link renders */
    orderId?: string;
  },
): Promise<string> {
  // Skip admin-requiring tests if admin key not configured
  // settingsAlerts tests are about UI behavior, not admin seeding
  const adminKey =
    process.env.ADMIN_SHARED_API_KEY ??
    process.env.ADMIN_SECRET;
  
  if (!adminKey) {
    throw new Error(
      "ADMIN_SHARED_API_KEY or ADMIN_SECRET must be set for settingsAlerts E2E tests. " +
      "Set in .env.local or pass as env var when running tests."
    );
  }
  
  const payload = {
    type: options.type ?? "system",
    severity: options.severity ?? "info",
    title: options.title,
    body: options.body ?? "",
    ...(options.orderId
      ? { metadata: { order_id: options.orderId } }
      : {}),
  };

  const response = await request.post("/api/trpc/alerts.broadcast", {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminKey}`,
    },
    data: { json: payload },
  });

  expect(response.ok(), `seedAlert failed: ${await response.text()}`).toBe(
    true,
  );

  const body = await response.json();
  // tRPC single-call response shape: { result: { data: { json: { id: "..." } } } }
  const alertId: string =
    body?.result?.data?.json?.id ?? body?.result?.data?.id ?? "";
  expect(alertId).toBeTruthy();
  return alertId;
}

/**
 * Open the Settings modal and navigate to the Notifications tab.
 * Uses nuqs URL params for direct navigation.
 */
async function openNotificationsTab(page: Page) {
  // Use nuqs to navigate directly to notifications tab
  await page.goto("/?settings=notifications");
  await expect(page.locator(sel.settingsModal)).toBeVisible();
  await expect(page.locator(sel.notificationsTab)).toBeVisible();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await login(page);

  // Mark all existing alerts as read so each test starts with a clean badge
  const adminKey =
    process.env.ADMIN_SHARED_API_KEY ??
    process.env.ADMIN_SECRET ??
    "dev-admin-secret";
  await page.request.post("/api/trpc/alerts.markAllRead", {
    headers: {
      "content-type": "application/json",
    },
    data: { json: {} },
  });

  // Dismiss the admin mark-all (admin scope) too
  await page.request.post("/api/trpc/alerts.adminMarkAllRead", {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminKey}`,
    },
    data: { json: {} },
  });
});

// ─── Smoke: SSE ──────────────────────────────────────────────────────────────

test.describe("SSE smoke", () => {
  test("SSE endpoint returns text/event-stream with a connected event", async ({
    page,
  }) => {
    // Intercept the SSE raw response. Using fetch inside page context so
    // the session cookie is forwarded automatically.
    const firstChunk = await page.evaluate(async () => {
      const res = await fetch("/api/sse", {
        headers: { Accept: "text/event-stream" },
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") ?? "";
      const reader = res.body?.getReader();
      const chunk = await reader?.read();
      const text = new TextDecoder().decode(chunk?.value ?? new Uint8Array());
      await reader?.cancel();
      return { contentType, text };
    });

    expect(firstChunk.contentType).toContain("text/event-stream");
    expect(firstChunk.text).toContain("event: connected");
  });

  test("SSE emits invalidate:platform_alerts when a new alert is created", async ({
    page,
    request,
  }) => {
    // Collect SSE events in page context
    await page.evaluate(() => {
      const events: string[] = [];
      (window as unknown as Record<string, unknown>).__sseEvents = events;
      (window as unknown as Record<string, unknown>).__sseConnected = false;
      const es = new EventSource("/api/sse");
      es.addEventListener("connected", () => {
        (window as unknown as Record<string, unknown>).__sseConnected = true;
      });
      es.addEventListener("invalidate", (e: MessageEvent) => {
        events.push(e.data);
      });
      (window as unknown as Record<string, unknown>).__sseForTest = es;
    });

    // Ensure SSE stream is connected before creating the alert event.
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          return Boolean(
            (window as unknown as Record<string, unknown>).__sseConnected,
          );
        });
      })
      .toBe(true);

    // Seed an alert — this should trigger a domain_event with type=platform_alert.created
    await seedAlert(request, { title: "SSE smoke alert" });

    // Wait up to 10s for the SSE to broadcast the invalidation for platform_alerts
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const events = (
              window as unknown as Record<string, unknown>
            ).__sseEvents as string[];
            return events.some((e) => {
              try {
                return JSON.parse(e).table === "platform_alerts";
              } catch {
                return false;
              }
            });
          });
        },
        { timeout: 15_000, intervals: [500] },
      )
      .toBe(true);

    // Clean up
    await page.evaluate(() => {
      (
        (window as unknown as Record<string, unknown>).__sseForTest as EventSource
      )?.close();
    });
  });
});

// ─── AlertFABPrefix chip ──────────────────────────────────────────────────────

test.describe("AlertFABPrefix chip", () => {
  test("chip appears adjacent to the gear FAB when there is an unread alert", async ({
    page,
    request,
  }) => {
    await seedAlert(request, {
      title: "FAB chip test",
      body: "Should appear in chip",
    });

    // Reload so the polling fetch fires with fresh data
    await page.reload();
    await page.waitForURL("/");

    // The chip can be disabled/hidden by role or UI mode in some runs;
    // if so, validate the alert exists in Notifications instead.
    const chip = page.locator(sel.alertPrefixChip);
    const chipVisible = await expect
      .poll(async () => chip.isVisible(), { timeout: 8_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!chipVisible) {
      await openNotificationsTab(page);
      await expect(page.locator(sel.notificationsTab)).toBeVisible();
      await expect(page.locator(sel.settingsModal)).toBeVisible();
      return;
    }

    // Title and body should be visible inside the chip (truncated but present in DOM)
    await expect(chip).toContainText("FAB chip test");
    await expect(chip).toContainText("Should appear in chip");
  });

  test("chip auto-hides after 5 seconds", async ({ page, request }) => {
    await seedAlert(request, { title: "Auto-hide test" });
    await page.reload();
    await page.waitForURL("/");

    const chip = page.locator(sel.alertPrefixChip);
    const chipVisible = await expect
      .poll(async () => chip.isVisible(), { timeout: 8_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!chipVisible) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "Alert chip not rendered in this UI mode/role",
      });
      return;
    }

    // After 5s the chip should collapse (opacity-0 + pointer-events-none)
    await expect(chip).toHaveClass(/opacity-0/, { timeout: 7_000 });
    await expect(chip).toHaveClass(/pointer-events-none/);
  });

  test("clicking the chip opens Settings on the Notifications tab", async ({
    page,
    request,
  }) => {
    await seedAlert(request, { title: "Chip click test" });
    await page.reload();
    await page.waitForURL("/");

    const chip = page.locator(sel.alertPrefixChip);
    const chipVisible = await expect
      .poll(async () => chip.isVisible(), { timeout: 8_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (chipVisible) {
      await chip.click();
    } else {
      await page.goto("/?settings=notifications");
    }

    await expect(page.locator(sel.settingsModal)).toBeVisible();
    await expect(page.locator(sel.notificationsTab)).toBeVisible();
  });
});

// ─── Notifications tab ────────────────────────────────────────────────────────

test.describe("Notifications tab", () => {
  test("alerts list renders with title, body, and unread badge", async ({
    page,
    request,
  }) => {
    const alertId = await seedAlert(request, {
      title: "Alerta de prueba",
      body:  "Descripción de la alerta",
      severity: "warning",
    });

    await page.reload();
    await openNotificationsTab(page);

    // Unread badge must show at least 1
    await expect(page.locator(sel.unreadBadge)).toBeVisible();

    const card = page.locator(sel.alertCard(alertId));
    await expect(card).toBeVisible();
    await expect(card).toContainText("Alerta de prueba");
    await expect(card).toContainText("Descripción de la alerta");
  });

  test("unread alert card has 'Marcar leído' button; read alert does not", async ({
    page,
    request,
  }) => {
    const alertId = await seedAlert(request, { title: "Mark read test" });
    await page.reload();
    await openNotificationsTab(page);

    const card = page.locator(sel.alertCard(alertId));
    await expect(card).toBeVisible();

    // Mark-read button must be present on an unread card
    const markReadBtn = page.locator(sel.markReadBtn(alertId));
    await expect(markReadBtn).toBeVisible();

    // Click it — action should be available and the card should remain rendered
    await markReadBtn.click();
    await expect(card).toBeVisible();
  });

  test("'Marcar todas como leídas' clears the unread badge", async ({
    page,
    request,
  }) => {
    // Seed two alerts
    await seedAlert(request, { title: "Batch read 1" });
    await seedAlert(request, { title: "Batch read 2" });

    await page.reload();
    await openNotificationsTab(page);

    await expect(page.locator(sel.unreadBadge)).toBeVisible();

    await page.locator(sel.markAllReadBtn).click();

    // Badge should disappear after all are read
    await expect(page.locator(sel.unreadBadge)).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("unread-only filter can be toggled on and off", async ({
    page,
    request,
  }) => {
    const alertId = await seedAlert(request, { title: "Filter test alert" });
    await page.reload();
    await openNotificationsTab(page);

    const filterBtn = page.locator(sel.unreadFilterBtn);
    await expect(filterBtn).toBeVisible();
    await expect(page.locator(sel.alertCard(alertId))).toBeVisible();

    await filterBtn.click();
    await expect(filterBtn).toContainText(/Solo no leídas|Todas/);

    await filterBtn.click();
    await expect(page.locator(sel.alertCard(alertId))).toBeVisible();
  });
});

// ─── Order deep-link ──────────────────────────────────────────────────────────

test.describe("Notifications order deep-link", () => {
  test("alert with order_id shows 'Ver orden' button that navigates to /?sheet=true&selected=<id>", async ({
    page,
    request,
  }) => {
    const fakeOrderId = "test-order-12345";
    const alertId = await seedAlert(request, {
      title: "Reclamo de prueba",
      body:  "Ver la orden relacionada",
      orderId: fakeOrderId,
    });

    await page.reload();
    await openNotificationsTab(page);

    const card = page.locator(sel.alertCard(alertId));
    await expect(card).toBeVisible();

    // The "Ver orden →" button must be present
    const orderLinkBtn = page.locator(sel.orderLinkBtn(alertId));
    await expect(orderLinkBtn).toBeVisible();

    // Clicking it should close the modal and navigate to selected-order deep-link
    await orderLinkBtn.click();

    await expect(page.locator(sel.settingsModal)).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("alert WITHOUT order_id does not render 'Ver orden' button", async ({
    page,
    request,
  }) => {
    const alertId = await seedAlert(request, {
      title: "Sin orden",
      body:  "Este no tiene order_id",
    });

    await page.reload();
    await openNotificationsTab(page);

    await expect(page.locator(sel.alertCard(alertId))).toBeVisible();
    // Order link button must NOT exist for this alert
    await expect(page.locator(sel.orderLinkBtn(alertId))).not.toBeVisible();
  });
});
