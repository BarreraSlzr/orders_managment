/**
 * E2E: Mercado Pago billing subscription lifecycle (T6)
 *
 * Covers:
 *  1) Billing onboarding page is reachable
 *  2) Subscribe action redirects to MP checkout URL
 *  3) Simulated subscription.activated enables entitlement gate
 *  4) Simulated subscription.canceled blocks entitlement gate
 *
 * Prerequisites:
 *  - Dev server running
 *  - E2E admin credentials set
 *  - ADMIN_SHARED_API_KEY (or ADMIN_SECRET) set
 *  - ENTITLEMENT_ENABLED=true for gate assertions
 */
import { expect, type Page, test } from "@playwright/test";

function getAdminKey(): string {
  const key = process.env.ADMIN_SHARED_API_KEY ?? process.env.ADMIN_SECRET ?? "";
  if (!key) {
    throw new Error(
      "ADMIN_SHARED_API_KEY or ADMIN_SECRET must be set for mercadopagoBilling E2E tests.",
    );
  }
  return key;
}

function getTenantName(): string {
  const tenant = process.env.E2E_ADMIN_TENANT ?? process.env.E2E_TENANT ?? "";
  if (!tenant) {
    throw new Error("Missing tenant env var: E2E_ADMIN_TENANT or E2E_TENANT.");
  }
  return tenant;
}

async function login(page: Page) {
  const tenant = getTenantName();
  const username = process.env.E2E_ADMIN_USERNAME ?? process.env.E2E_USERNAME ?? "";
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD ?? "";

  if (!username || !password) {
    throw new Error(
      "Missing E2E admin credentials. Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD.",
    );
  }

  await page.goto("/login");
  await page.getByLabel(/tenant/i).fill(tenant);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
}

async function simulateBillingEvent(page: Page, payload: {
  eventType: string;
  status: "active" | "canceled";
  externalEventId: string;
}) {
  const adminKey = getAdminKey();
  const tenantName = getTenantName();

  const res = await page.request.post("/api/billing/mercadopago/webhook/test", {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminKey}`,
    },
    data: {
      tenantName,
      provider: "mercadopago",
      eventType: payload.eventType,
      status: payload.status,
      externalSubscriptionId: "sub_e2e_billing",
      externalEventId: payload.externalEventId,
      metadata: { source: "playwright-e2e" },
    },
  });

  expect(res.ok(), await res.text()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("billing subscribe redirects to MP checkout URL", async ({ page }) => {
  let sawMercadoPagoRedirect = false;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && frame.url().includes("mercadopago.com")) {
      sawMercadoPagoRedirect = true;
    }
  });

  await page.route("**/api/billing/subscribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "sub_test_123",
        init_point: "https://www.mercadopago.com.mx/subscriptions/checkout?pref_id=test",
      }),
    });
  });

  await page.goto("/onboardings/billing");
  await expect(page.getByRole("heading", { name: /activar suscripción/i })).toBeVisible();

  await page.locator("#payer-email").first().fill("billing-e2e@example.com");
  await page.getByRole("button", { name: /suscribirse/i }).click();

  await expect
    .poll(() => sawMercadoPagoRedirect, {
      timeout: 10_000,
      message: "Expected main frame to navigate to Mercado Pago checkout",
    })
    .toBe(true);
});

test("billing webhook simulation toggles entitlement gate", async ({ page }) => {
  test.skip(
    process.env.ENTITLEMENT_ENABLED !== "true",
    "Set ENTITLEMENT_ENABLED=true to assert gate behavior",
  );

  await simulateBillingEvent(page, {
    eventType: "subscription.activated",
    status: "active",
    externalEventId: "evt-billing-activated-e2e",
  });

  const allowed = await page.request.get(
    "/api/mercadopago/oauth/authorize?email=e2e-billing@example.com",
    {
      maxRedirects: 0,
      failOnStatusCode: false,
    },
  );

  const allowedLocation = allowed.headers()["location"] ?? "";
  expect(allowedLocation).not.toContain("mp_oauth=entitlement_error");

  await simulateBillingEvent(page, {
    eventType: "subscription.canceled",
    status: "canceled",
    externalEventId: "evt-billing-canceled-e2e",
  });

  const blocked = await page.request.get(
    "/api/mercadopago/oauth/authorize?email=e2e-billing@example.com",
    {
      maxRedirects: 0,
      failOnStatusCode: false,
    },
  );

  const blockedLocation = blocked.headers()["location"] ?? "";
  expect(blockedLocation).toContain("mp_oauth=entitlement_error");
});
