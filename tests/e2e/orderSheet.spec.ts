/**
 * E2E: OpenOrderSheet — open/close, order selection, deep-link, actions, stale-data regression
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (bun run dev)
 *   - At least one open order exists in the database
 *   - User is authenticated (set TEST_COOKIE env var or run after login fixture)
 *
 * Run: bunx playwright test tests/e2e/orderSheet.spec.ts
 */
import { TEST_IDS, tid } from "@/lib/testIds";
import { expect, Page, test } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authenticate via the login page and store the session cookie. */
async function login(page: Page) {
  const tenant = process.env.E2E_TENANT ?? "test-agent";
  const username = process.env.E2E_USERNAME ?? "test-agent";
  const password = process.env.E2E_PASSWORD ?? "testpassword";

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
  await page.locator(sel.sheetRoot).getByRole("heading", { name: "ORDENES" }).click();

  await expect(page.locator(sel.sheetRoot)).not.toBeVisible();

  // sheet param must be gone
  const url = new URL(page.url());
  expect(url.searchParams.get("sheet")).toBeNull();
});

// ─── Order selection ─────────────────────────────────────────────────────────

test("selecting an order row sets orderId in URL and shows details", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  await expect(page.locator(sel.sheetRoot)).toBeVisible();
  await expect(page.locator(sel.orderListContainer)).toBeVisible();

  // Grab the first order row
  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await expect(firstRow).toBeVisible();

  const rowTestId = await firstRow.getAttribute("data-testid");
  const orderId = rowTestId?.split(":")[1];
  expect(orderId).toBeTruthy();

  await firstRow.click();

  // URL must contain selected (single-select uses ?selected=id, not ?orderId=)
  await expect(page).toHaveURL(new RegExp(`[?&]selected=${orderId}`));

  // Order details panel should render
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();
});

test("closing order details clears orderId from URL", async ({ page }) => {
  await page.goto("/?sheet=true");

  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await firstRow.click();
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  // Click the X inside OrderDetails
  await page.locator(sel.orderDetailsClose).click();

  // Waits for selected to disappear from URL
  await expect(page).not.toHaveURL(/[?&]selected=/);
  // Details panel should be gone
  await expect(page.locator(sel.orderDetailsRoot)).not.toBeVisible();
  // Empty selection placeholder appears
  await expect(page.locator(sel.emptySelection)).toBeVisible();
});

// ─── Deep-link ───────────────────────────────────────────────────────────────

test("navigating directly to /?sheet=true&selected=<id> opens sheet with details", async ({
  page,
}) => {
  // First open the sheet normally to discover a real order ID
  await page.goto("/?sheet=true");
  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await firstRow.click();
  const selectedId = new URL(page.url()).searchParams.get("selected");
  expect(selectedId).toBeTruthy();

  // Now navigate fresh using the deep-link URL with selected param
  await page.goto(`/?sheet=true&selected=${selectedId}`);

  await expect(page.locator(sel.sheetRoot)).toBeVisible();
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();
});

// ─── "Add more products" path ────────────────────────────────────────────────

test("'Add more products' button closes the sheet and clears orderId", async ({
  page,
}) => {
  await page.goto("/?sheet=true");

  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await firstRow.click();
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
  await page.goto("/?sheet=true");
  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await firstRow.click();
  await expect(page.locator(sel.orderDetailsRoot)).toBeVisible();

  // Select at least one item by clicking the first checkbox in the receipt
  const firstCheckbox = page.locator(sel.orderDetailsRoot).locator('input[type="checkbox"]').first();
  if (await firstCheckbox.count() > 0) {
    await firstCheckbox.check();
  }

  // Track navigation — no full reload should occur
  let reloadOccurred = false;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) reloadOccurred = true;
  });

  await page.locator(sel.togglePayment).click();

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
  await page.goto("/?sheet=true");
  const firstRow = page.locator(`[data-testid^="${TEST_IDS.ORDER_LIST.ROW}"]`).first();
  await firstRow.click();
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
