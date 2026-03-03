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
  if ((await rows.count()) > 0) {
    const testId = await rows.first().getAttribute("data-testid");
    const orderId = testId?.split(":")[1];
    if (orderId) return orderId;
  }

  await page.goto("/");

  const createBtn = page
    .locator(`[data-testid="${TEST_IDS.PRODUCT_CARD.CREATE_ORDER}"]`)
    .first();

  if ((await createBtn.count()) === 0) {
    const uniqueName = `E2E Producto MP ${Date.now()}`;
    await page.goto("/?selected=new");
    await expect(page.locator("form#product-form")).toBeVisible({ timeout: 10_000 });
    await page.locator('input[id="name"]').fill(uniqueName);
    await page.locator('input[id="price"]').fill("100");
    await page.locator('button[data-intent="save"]').click();
    await expect(page.locator("form#product-form")).not.toBeVisible({ timeout: 10_000 });
    await page.goto("/");
  }

  await expect(createBtn).toBeVisible({ timeout: 10_000 });
  await createBtn.click();

  await expect(page).toHaveURL(/[?&]selected=/);
  const selectedId = new URL(page.url()).searchParams.get("selected") ?? "";
  if (selectedId) return selectedId;

  await page.goto("/?sheet=true");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });

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
    attemptId?: number;
  };

  expect(payload.status).toBe("rejected");
  expect(payload.retryReady).toBe(true);
  expect(typeof payload.attemptId).toBe("number");
});
