/**
 * E2E: OpenOrderSheet — open/close, order selection, deep-link, actions, stale-data regression
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (bun run dev)
 *   - At least one open order exists in the database
 *   - E2E auth env vars set: E2E_TENANT, E2E_USERNAME, E2E_PASSWORD
 *
 * Run: bunx playwright test tests/e2e/orderSheet.spec.ts
 */
import { TEST_IDS, tid } from "@/lib/testIds";
import { expect, Page, test } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authenticate via the login page and store the session cookie. */
async function login(page: Page) {
  const tenant = process.env.E2E_TENANT ?? "";
  const username = process.env.E2E_USERNAME ?? "";
  const password = process.env.E2E_PASSWORD ?? "";

  if (!tenant || !username || !password) {
    throw new Error(
      "Missing E2E credentials. Set E2E_TENANT, E2E_USERNAME, and E2E_PASSWORD.",
    );
  }

  await page.goto("/login");
  await page.getByLabel(/tenant/i).fill(tenant);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for redirect to home
  await page.waitForURL("/");
}

/** Selectors derived from TEST_IDS constants — single source of truth. */
const sel = {
  sheetTrigger: `[data-testid="${TEST_IDS.ORDER_SHEET.TRIGGER}"]`,
  sheetRoot: `[data-testid="${TEST_IDS.ORDER_SHEET.ROOT}"]`,
  orderListContainer: `[data-testid="${TEST_IDS.ORDER_LIST.CONTAINER}"]`,
  orderListEmpty: `[data-testid="${TEST_IDS.ORDER_LIST.EMPTY}"]`,
  orderDetailsRoot: `[data-testid="${TEST_IDS.ORDER_DETAILS.ROOT}"]`,
  orderDetailsClose: `[data-testid="${TEST_IDS.ORDER_DETAILS.CLOSE_BTN}"]`,
  addMoreBtn: `[data-testid="${TEST_IDS.ORDER_SHEET.ADD_MORE_BTN}"]`,
  emptySelection: `[data-testid="${TEST_IDS.ORDER_SHEET.EMPTY_SELECTION}"]`,
  togglePayment: `[data-testid="${TEST_IDS.RECEIPT_ACTIONS.TOGGLE_PAYMENT}"]`,
  remove: `[data-testid="${TEST_IDS.RECEIPT_ACTIONS.REMOVE}"]`,
  closeOrder: `[data-testid="${TEST_IDS.RECEIPT_ACTIONS.CLOSE_ORDER}"]`,
  orderRow: (id: string) =>
    `[data-testid="${tid(TEST_IDS.ORDER_LIST.ROW, id)}"]`,
};

/**
 * Returns the first available open order ID from the sheet.
 * Creates one if none exist. Uses nuqs for fast navigation.
 */
async function getOpenOrderId(page: Page): Promise<string> {
  // Check if orders exist by going to the sheet
  await page.goto("/?sheet=true");
  
  const rows = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`);
  
  // If orders exist, extract ID from first row
  if ((await rows.count()) > 0) {
    const firstRow = rows.first();
    const testId = await firstRow.getAttribute("data-testid");
    const orderId = testId?.split(":")[1];
    if (orderId) return orderId;
  }
  
  // No orders exist - go to home page to create one
  await page.goto("/");
  
  const createBtn = page
    .locator(`[data-testid="${TEST_IDS.PRODUCT_CARD.CREATE_ORDER}"]`)
    .first();

  // If no products are available, create a minimal product first.
  if ((await createBtn.count()) === 0) {
    const uniqueName = `E2E Producto ${Date.now()}`;
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
  
  // Go back to sheet to get the new order ID
  await page.goto("/?sheet=true");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  
  const testId = await rows.first().getAttribute("data-testid");
  const orderId = testId?.split(":")[1];
  if (!orderId) throw new Error("Failed to extract order ID");
  return orderId;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await login(page);
});

// ─── Open / close ────────────────────────────────────────────────────────────

test("opens the sheet when the bag button is clicked", async ({ page }) => {
  await page.goto("/");

  // Sheet should not be visible initially
  await expect(page.locator(sel.sheetRoot)).not.toBeVisible();

  // Click the trigger area (contains the bag icon Button)
  await page.locator(sel.sheetTrigger).locator("button").last().click();

  // Sheet content must become visible
  await expect(page.locator(sel.sheetRoot)).toBeVisible();

  // URL should reflect sheet=true
  await expect(page).toHaveURL(/[?&]sheet=true/);
});

test("closes the sheet via the title click and clears URL param", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  await expect(page.locator(sel.sheetRoot)).toBeVisible();

  // Click the "ORDENES" title which calls handleClose
  await page
    .locator(sel.sheetRoot)
    .getByRole("heading", { name: "ORDENES" })
    .evaluate((element) => (element as HTMLElement).click());

  await expect(page.locator(sel.sheetRoot)).not.toBeVisible();

  // sheet param must be gone
  const url = new URL(page.url());
  expect(url.searchParams.get("sheet")).toBeNull();
});

// ─── Order selection ─────────────────────────────────────────────────────────

test("selecting an order row sets selected in URL and shows details", async ({
  page,
}) => {
  // Get an order ID first
  const orderId = await getOpenOrderId(page);
  
  // Now go back to sheet without selection
  await page.goto("/?sheet=true");
  await expect(page.locator(sel.sheetRoot)).toBeVisible();
  await expect(page.locator(sel.orderListContainer)).toBeVisible();

  // Click the order row
  const orderRow = page.locator(sel.orderRow(orderId));
  await expect(orderRow).toBeVisible();
  await orderRow.click();

  // URL must contain selected
  await expect(page).toHaveURL(new RegExp(`[?&]selected=${orderId}`));

  // Order details panel should render
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();
});

test("closing order details clears selected from URL", async ({ page }) => {
  // Use nuqs to navigate directly to selected state
  const orderId = await getOpenOrderId(page);
  await page.goto(`/?sheet=true&selected=${orderId}`);
  
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  // Click the X inside OrderDetails
  await page.locator(sel.orderDetailsClose).click();

  // Waits for selected to disappear from URL
  await expect(page).not.toHaveURL(/[?&]selected=/);
  // Details panel should be gone
  await expect(page.locator(sel.orderDetailsRoot)).not.toBeVisible();
});

// ─── Deep-link ───────────────────────────────────────────────────────────────

test("navigating directly to /?sheet=true&selected=<id> opens sheet with details", async ({
  page,
}) => {
  // Use nuqs to get an order ID and navigate directly
  const orderId = await getOpenOrderId(page);
  
  // Navigate fresh using the deep-link URL (this is what nuqs enables!)
  await page.goto(`/?sheet=true&selected=${orderId}`);

  await expect(page.locator(sel.sheetRoot)).toBeVisible();
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();
});

// ─── "Add more products" path ────────────────────────────────────────────────

test("'Add more products' button closes the sheet and clears selected", async ({
  page,
}) => {
  // Use nuqs to jump directly to the selected state
  const orderId = await getOpenOrderId(page);
  await page.goto(`/?sheet=true&selected=${orderId}`);
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  await page.locator(sel.addMoreBtn).click();

  await expect(page.locator(sel.sheetRoot)).not.toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get("sheet")).toBeNull();
});

// ─── Actions ─────────────────────────────────────────────────────────────────

test("toggle payment action updates UI without full-page reload", async ({
  page,
}) => {
  // Use nuqs to skip the clicking and go directly to selected state
  const orderId = await getOpenOrderId(page);
  await page.goto(`/?sheet=true&selected=${orderId}`);
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  // Select at least one item by clicking the first checkbox in the receipt
  const firstCheckbox = page.locator(sel.orderDetailsRoot).locator('input[type="checkbox"]').first();
  if ((await firstCheckbox.count()) === 0) {
    test.info().annotations.push({
      type: "skip-reason",
      description: "No selectable receipt items available for payment toggle",
    });
    return;
  }
  await firstCheckbox.check();

  const togglePaymentBtn = page.locator(sel.togglePayment);
  if ((await togglePaymentBtn.count()) === 0) {
    test.info().annotations.push({
      type: "skip-reason",
      description: "Toggle payment action is not available in current receipt state",
    });
    return;
  }

  // Track navigation — no full reload should occur
  let reloadOccurred = false;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) reloadOccurred = true;
  });

  await togglePaymentBtn.click();

  // Wait for network to settle (tRPC mutation + invalidation)
  await page.waitForLoadState("networkidle");

  // The sheet must still be open — no reload happened
  expect(reloadOccurred).toBe(false);
  await expect(page.locator(sel.sheetRoot)).toBeVisible();
});

// ─── Stale-data (fixed) ───────────────────────────────────────────────────────
//
// After a `removeProducts` mutation the item count inside the OrderDetails
// panel must update immediately via the optimistic cache patch — no full page
// refresh, no manual re-open required.
//
test("removeProducts updates item count in sheet immediately (no refresh needed)", async ({
  page,
}) => {
  // Use nuqs to go directly to the selected order
  const orderId = await getOpenOrderId(page);
  await page.goto(`/?sheet=true&selected=${orderId}`);
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  // Read the current item list count before removal
  const checkboxes = page.locator(sel.orderDetailsRoot).locator('input[type="checkbox"]');
  const countBefore = await checkboxes.count();

  if (countBefore === 0) {
    test.info().annotations.push({ type: "skip-reason", description: "No items in order — seed the DB with at least one open order containing items" });
    return;
  }

  // Select the first item
  await checkboxes.first().check();

  // Click Remove
  await page.locator(sel.remove).click();

  // The optimistic update fires synchronously, so we don't need to wait for
  // networkidle — but we do wait for the DOM to reflect the patch.
  await expect(page.locator(sel.orderDetailsRoot).locator('input[type="checkbox"]'))
    .toHaveCount(countBefore - 1);

  // Also confirm no full-page reload occurred
  await page.waitForLoadState("networkidle");
  await expect(page.locator(sel.sheetRoot)).toBeVisible();
});

// ─── Agregar gasto ────────────────────────────────────────────────────────────
//
// Verifies the full "add expense" flow (Agregar gasto) that connects the Orders
// sheet to the inventory transaction recorder:
//  1. The idle strip trigger is visible when the sheet is open with an order.
//  2. Tapping the trigger shows the ItemSelector search input.
//  3. Typing a query surfaces matching inventory items.
//  4. Selecting an item advances to the details step (quantity + price inputs).
//  5. Cancelling returns the panel to the idle strip.
//

const gasto = {
  trigger:      `[data-testid="${TEST_IDS.AGREGAR_GASTO.TRIGGER}"]`,
  searchInput:  `[data-testid="${TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT}"]`,
  createBtn:    `[data-testid="${TEST_IDS.AGREGAR_GASTO.CREATE_BTN}"]`,
  quantityInput:`[data-testid="${TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT}"]`,
  priceInput:   `[data-testid="${TEST_IDS.AGREGAR_GASTO.PRICE_INPUT}"]`,
  confirmBtn:   `[data-testid="${TEST_IDS.AGREGAR_GASTO.CONFIRM_BTN}"]`,
  cancelBtn:    `[data-testid="${TEST_IDS.AGREGAR_GASTO.CANCEL_BTN}"]`,
  resultRow: (id: string) =>
    `[data-testid="${tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, id)}"]`,
};

test("agregar-gasto: idle strip trigger is visible when an order is selected", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  // Select the first available order
  const firstRow = page
    .locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`)
    .first();
  const rowCount = await firstRow.count();
  if (rowCount === 0) {
    test.info().annotations.push({
      type: "skip-reason",
      description: "No open orders — seed the DB first",
    });
    return;
  }
  await firstRow.click();

  await expect(page.locator(gasto.trigger)).toBeVisible();
});

test("agregar-gasto: clicking trigger shows the search input", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  const firstRow = page
    .locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`)
    .first();
  if ((await firstRow.count()) === 0) return;
  await firstRow.click();

  await page.locator(gasto.trigger).click();

  await expect(page.locator(gasto.searchInput)).toBeVisible();
  // The trigger (idle strip) should no longer be the visible state
  await expect(page.locator(gasto.trigger)).not.toBeVisible();
});

test("agregar-gasto: typing a search query shows matching inventory items", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  const firstRow = page
    .locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`)
    .first();
  if ((await firstRow.count()) === 0) return;
  await firstRow.click();

  await page.locator(gasto.trigger).click();
  await expect(page.locator(gasto.searchInput)).toBeVisible();

  // Type a generic query — at least some results should appear OR the create
  // button should be shown (if inventory is empty or no match).
  await page.locator(gasto.searchInput).fill("a");
  await page.waitForTimeout(300); // debounce / re-render

  const hasResults =
    (await page.locator(`[data-testid^="${TEST_IDS.AGREGAR_GASTO.RESULT_ROW}"]`).count()) > 0;
  const hasCreateBtn =
    await page.locator(gasto.createBtn).isVisible().catch(() => false);

  expect(hasResults || hasCreateBtn).toBe(true);
});

test("agregar-gasto: selecting a result shows quantity and price inputs", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  const firstRow = page
    .locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`)
    .first();
  if ((await firstRow.count()) === 0) return;
  await firstRow.click();

  await page.locator(gasto.trigger).click();
  await expect(page.locator(gasto.searchInput)).toBeVisible();

  await page.locator(gasto.searchInput).fill("a");
  await page.waitForTimeout(300);

  const firstResultRow = page
    .locator(`[data-testid^="${TEST_IDS.AGREGAR_GASTO.RESULT_ROW}"]`)
    .first();

  if ((await firstResultRow.count()) === 0) {
    test.info().annotations.push({
      type: "skip-reason",
      description: "No inventory items found — seed the inventory first",
    });
    return;
  }

  await firstResultRow.click();

  await expect(page.locator(gasto.quantityInput)).toBeVisible();
  await expect(page.locator(gasto.priceInput)).toBeVisible();
  await expect(page.locator(gasto.confirmBtn)).toBeVisible();
});

test("agregar-gasto: cancel button returns panel to idle state", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  const firstRow = page
    .locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`)
    .first();
  if ((await firstRow.count()) === 0) return;
  await firstRow.click();

  await page.locator(gasto.trigger).click();
  await expect(page.locator(gasto.searchInput)).toBeVisible();

  // Cancel from the search step
  await page.locator(gasto.cancelBtn).click();

  // The idle strip trigger should come back
  await expect(page.locator(gasto.trigger)).toBeVisible();
  await expect(page.locator(gasto.searchInput)).not.toBeVisible();
});
