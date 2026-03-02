/**
 * E2E: Mercado Pago rejected payment flow (T4)
 *
 * Covers:
 *  1) Simulate rejected payment webhook for a real order
 *  2) Verify latest attempt status is rejected
 *  3) Verify retry is allowed (no active in-progress attempt remains)
 */
import { TEST_IDS } from "@/lib/testIds";
import { expect, type Page, test } from "@playwright/test";

function getAdminKey(): string {
  const key = process.env.ADMIN_SHARED_API_KEY ?? process.env.ADMIN_SECRET ?? "";
  if (!key) {
    throw new Error(
      "ADMIN_SHARED_API_KEY or ADMIN_SECRET must be set for mercadopagoPayment E2E tests.",
    );
  }
  return key;
}

async function login(page: Page) {
  const tenant = process.env.E2E_ADMIN_TENANT ?? process.env.E2E_TENANT ?? "";
  const username = process.env.E2E_ADMIN_USERNAME ?? process.env.E2E_USERNAME ?? "";
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD ?? "";

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

async function getOpenOrderId(page: Page): Promise<string> {
  await page.goto("/?sheet=true");
  const rows = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`);
  const count = await rows.count();

  if (count === 0) {
    throw new Error(
      "No open orders found for rejected payment E2E. Seed data first with bun run seed:test-agent.",
    );
  }

  const testId = await rows.first().getAttribute("data-testid");
  const orderId = testId?.split(":")[1];
  if (!orderId) {
    throw new Error("Failed to parse order id from order row test id.");
  }
  return orderId;
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("rejected payment webhook simulation marks attempt rejected and keeps retry available", async ({
  page,
}) => {
  const orderId = await getOpenOrderId(page);
  const adminKey = getAdminKey();

  const res = await page.request.post("/api/mercadopago/webhook/test/rejected", {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminKey}`,
    },
    data: {
      orderId,
      paymentId: `pay-rejected-${orderId.slice(0, 8)}`,
      notificationId: `notif-rejected-${orderId.slice(0, 8)}`,
    },
  });

  expect(res.ok(), await res.text()).toBe(true);
  const payload = (await res.json()) as {
    status?: string;
    retryReady?: boolean;
  };

  expect(payload.status).toBe("rejected");
  expect(payload.retryReady).toBe(true);

  const statusRes = await page.request.post("/api/trpc/mercadopago.payment.status", {
    headers: {
      "content-type": "application/json",
    },
    data: {
      json: { orderId },
    },
  });

  expect(statusRes.ok(), await statusRes.text()).toBe(true);
  const statusBody = (await statusRes.json()) as {
    result?: { data?: { json?: { status?: string } } };
  };

  expect(statusBody?.result?.data?.json?.status).toBe("rejected");
});
