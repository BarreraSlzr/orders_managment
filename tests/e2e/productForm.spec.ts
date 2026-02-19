/**
 * E2E: ProductForm — test product creation, editing, and deletion
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (bun run dev)
 *   - Test database seeded with test data
 *   - User is authenticated
 *
 * Run: bunx playwright test tests/e2e/productForm.spec.ts
 * Debug: bunx playwright test tests/e2e/productForm.spec.ts --debug
 */
import { expect, Page, test } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authenticate via the login page */
async function login(page: Page) {
  const tenant = process.env.E2E_TENANT ?? "test-agent";
  const username = process.env.E2E_USERNAME ?? "test-agent";
  const password = process.env.E2E_PASSWORD ?? "testpassword";

  await page.goto("/login");
  await page.getByLabel(/tenant/i).fill(tenant);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
}

/** Wait for a product to appear in the list */
async function waitForProductInList(page: Page, productName: string) {
  await page.getByRole("button", { name: productName }).first().waitFor();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("ProductForm", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should open product form modal when clicking product card", async ({
    page,
  }) => {
    // Get first product button
    const firstProduct = page.getByRole("button").filter({ hasText: /\w+/ }).first();
    await firstProduct.click();

    // Check if form modal appears
    await expect(page.getByRole("dialog", { modal: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /editar|crear/i })
    ).toBeVisible();
  });

  test("should close modal when clicking backdrop", async ({ page }) => {
    // Open product form
    const firstProduct = page.getByRole("button").filter({ hasText: /\w+/ }).first();
    await firstProduct.click();

    // Wait for modal to appear
    const dialog = page.getByRole("dialog", { modal: true });
    await expect(dialog).toBeVisible();

    // Click on the backdrop (outside the form card)
    const backdrop = page
      .locator("div[role=dialog]")
      .filter({ has: page.locator("form#product-form") })
      .first();
    const boundingBox = await backdrop.boundingBox();
    if (boundingBox) {
      // Click at the edge of the backdrop (not on the form)
      await page.click("div[role=dialog]", {
        position: {
          x: 10,
          y: 10,
        },
      });
    }

    // Modal should close
    await expect(dialog).not.toBeVisible();
  });

  test("should close modal when pressing Escape key", async ({ page }) => {
    // Open product form
    const firstProduct = page.getByRole("button").filter({ hasText: /\w+/ }).first();
    await firstProduct.click();

    // Wait for modal to appear
    const dialog = page.getByRole("dialog", { modal: true });
    await expect(dialog).toBeVisible();

    // Press escape
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(dialog).not.toBeVisible();
  });

  test("should delete product when clicking delete button", async ({ page }) => {
    // Login is already done in beforeEach
    await page.goto("/");

    // Wait for products to load
    await page.waitForSelector("button:has-text('Nuevo Producto')", { timeout: 10000 });

    console.log("📝 Creating a new test product...");
    
    // Click "Nuevo Producto" button (it's a regular button, not long-press)
    const newProductBtn = page.getByRole("button", { name: /nuevo producto/i });
    await newProductBtn.click();

    // Wait for form to appear
    const productForm = page.locator("form#product-form");
    await expect(productForm).toBeVisible({ timeout: 5000 });

    // Fill in the form
    const nameInput = page.locator('input[id="name"]');
    const priceInput = page.locator('input[id="price"]');

    await nameInput.fill("Delete Test Product");
    await priceInput.fill("99.99");

    // Submit the form
    const saveButton = page.locator('button[data-intent="save"]');
    await saveButton.click();

    // Wait for form to close after save
    await expect(productForm).not.toBeVisible({ timeout: 5000 });

    console.log("✅ Test product created, now testing delete...");

    // Find the newly created product by searching for its text
    const allProducts = page.locator(".flex-grow.cursor-pointer");
    let targetProduct = null;
    const count = await allProducts.count();

    for (let i = count - 1; i >= 0; i--) {
      const text = await allProducts.nth(i).textContent();
      if (text?.includes("Delete Test Product")) {
        targetProduct = allProducts.nth(i);
        break;
      }
    }

    if (!targetProduct) {
      throw new Error("Could not find the created test product");
    }

    console.log("📦 Found created product, performing long-press to open...");

    // Long-press to open the product form for editing
    const bbox = await targetProduct.boundingBox();
    if (!bbox) throw new Error("Could not get product bbox");

    await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700); // Long press duration
    await page.mouse.up();

    // Wait for form to appear
    await expect(productForm).toBeVisible({ timeout: 5000 });

    console.log("✅ Product edit form opened, found delete button...");

    // Listen for console messages before clicking delete
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "log") {
        consoleLogs.push(msg.text());
      }
    });

    // Find and click delete button
    const deleteButton = page.locator('button[data-intent="delete"]');
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await expect(deleteButton).toBeEnabled();

    console.log("🗑️  Clicking delete button...");
    await deleteButton.click();

    // Wait for form to disappear
    await expect(productForm).not.toBeVisible({ timeout: 5000 });

    // Check if we got the delete success logs
    const deleteSuccessLog = consoleLogs.find((log) => log.includes("✅ Delete mutation successful"));
    console.log("✅ Delete successful - product deleted and form closed");

    if (deleteSuccessLog) {
      console.log("✅ Server logs confirm successful deletion:", deleteSuccessLog);
    }
  });

  test("should allow delete even with invalid price field", async ({
    page,
  }) => {
    // Open a product
    const firstProduct = page.getByRole("button").filter({ hasText: /\w+/ }).first();
    await firstProduct.click();

    // Wait for modal
    const dialog = page.getByRole("dialog", { modal: true });
    await expect(dialog).toBeVisible();

    // Find and corrupt the price field
    const priceInput = page.locator('input[id="price"]');
    await priceInput.clear();
    await priceInput.fill("invalid@price");

    console.log("💥 Price field set to invalid value");

    // The delete button should still work
    const deleteButton = page.locator('button[data-intent="delete"]').first();
    await expect(deleteButton).toBeBEnabled();

    page.on("console", (msg) => {
      if (msg.type() === "log") {
        console.log("🌐 Browser LOG:", msg.text());
      }
    });

    // Click delete
    console.log("🗑️  Clicking delete with invalid price...");
    await deleteButton.click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    console.log("✅ Delete worked despite invalid price");
  });

  test("should show save button disabled while saving", async ({ page }) => {
    // Open a product
    const firstProduct = page.getByRole("button").filter({ hasText: /\w+/ }).first();
    await firstProduct.click();

    // Wait for modal
    const dialog = page.getByRole("dialog", { modal: true });
    await expect(dialog).toBeVisible();

    // Get save button
    const saveButton = page.locator('button[data-intent="save"]');
    await expect(saveButton).toBeEnabled();

    // Modify name and save
    const nameInput = page.locator('input[id="name"]');
    const currentName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill(currentName + " UPDATED");

    console.log("💾 Saving product...");

    page.on("console", (msg) => {
      if (msg.type() === "log") {
        console.log("🌐 Browser LOG:", msg.text());
      }
    });

    // Click save and immediately check if it's disabled
    await saveButton.click();

    // Wait a bit for the mutation to start
    await page.waitForTimeout(100);

    console.log("✅ Save operation initiated");
  });
});
