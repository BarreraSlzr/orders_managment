/**
 * Seed script: duplicate the `cafe&baguettes` tenant as `test-agent`
 *
 * Usage:
 *   bun run scripts/seed-test-agent.ts
 *
 * The script is IDEMPOTENT — if a tenant named "test-agent" already exists it
 * prints a summary and exits without touching existing data.
 *
 * What is copied:
 *   payment_options, categories, extras, products, inventory_items,
 *   category_inventory_item, users (admin re-hashed to E2E_PASSWORD),
 *   open orders + order_items + order_item_extras, transactions
 *
 * Env vars honoured:
 *   E2E_USERNAME (default: "test-agent")
 *   E2E_PASSWORD (default: "testpassword")
 *
 * Canonical timestamp: all timestamps written via getIsoTimestamp() from
 * @/utils/stamp per project LEGEND.
 */

import { randomUUID } from "crypto";
import { db } from "../lib/sql/database";
import { hashPassword } from "../lib/auth/passwords";
import { createUser } from "../lib/sql/functions/users";
import { getIsoTimestamp } from "../utils/stamp";

// ─── Config ──────────────────────────────────────────────────────────────────

const SOURCE_TENANT_NAME = "cafe&baguettes";
const TARGET_TENANT_NAME = "test-agent";
const E2E_USERNAME = process.env.E2E_USERNAME ?? "test-agent";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "testpassword";
const RESET = process.argv.includes("--reset");
/** Cap how many open orders are cloned (enough for e2e, avoids timeout on large tenants) */
const MAX_ORDERS = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(`[seed-test-agent] ${msg}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {log("Starting tenant duplication…");

// 1. Resolve source tenant
const sourceTenant = await db
  .selectFrom("tenants")
  .selectAll()
  .where("name", "=", SOURCE_TENANT_NAME)
  .executeTakeFirst();

if (!sourceTenant) {
  log(`ERROR: source tenant "${SOURCE_TENANT_NAME}" not found. Aborting.`);
  process.exit(1);
}

const sourceTenantId = sourceTenant.id as string;
log(`Source tenant: ${sourceTenantId} (${SOURCE_TENANT_NAME})`);

// 2. Check if target already exists (idempotent guard)
const existingTarget = await db
  .selectFrom("tenants")
  .selectAll()
  .where("name", "=", TARGET_TENANT_NAME)
  .executeTakeFirst();

if (existingTarget) {
  if (!RESET) {
    log(`Tenant "${TARGET_TENANT_NAME}" already exists (${existingTarget.id}). Use --reset to rebuild.`);
    await db.destroy();
    process.exit(0);
  }
  log(`--reset: deleting all data for "${TARGET_TENANT_NAME}" (${existingTarget.id})…`);
  const tid = existingTarget.id as string;
  // Delete in FK-safe order
  await db.deleteFrom("order_item_extras").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("order_items").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("orders").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("transactions").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("category_inventory_item").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("inventory_items").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("categories").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("extras").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("products").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("payment_options").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("users").where("tenant_id", "=", tid).execute();
  await db.deleteFrom("tenants").where("id", "=", tid).execute();
  log("Reset complete.");
}

// 3. Create new tenant
const newTenantId = randomUUID();
const nowIso = getIsoTimestamp();

await db
  .insertInto("tenants")
  .values({ id: newTenantId, name: TARGET_TENANT_NAME, created: nowIso, updated: nowIso })
  .execute();

log(`Created tenant "${TARGET_TENANT_NAME}" → ${newTenantId}`);

// ─── Copy each table ─────────────────────────────────────────────────────────
// We maintain UUID remapping maps so FK references stay consistent.

// 4. payment_options (int id — auto-generated; keep mapping old→new int id)
const srcPaymentOptions = await db
  .selectFrom("payment_options")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .execute();

const paymentOptionIdMap = new Map<number, number>(); // old id → new id

for (const po of srcPaymentOptions) {
  const inserted = await db
    .insertInto("payment_options")
    .values({ name: po.name, tenant_id: newTenantId, created: nowIso })
    .returning("id")
    .executeTakeFirstOrThrow();
  paymentOptionIdMap.set(po.id as unknown as number, inserted.id as unknown as number);
}
log(`Copied ${paymentOptionIdMap.size} payment_options`);

// 5. categories
const srcCategories = await db
  .selectFrom("categories")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .where("deleted", "is", null)
  .execute();

const categoryIdMap = new Map<string, string>();

for (const cat of srcCategories) {
  const newId = randomUUID();
  categoryIdMap.set(cat.id as string, newId);
  await db
    .insertInto("categories")
    .values({ id: newId, name: cat.name, tenant_id: newTenantId, created: nowIso, updated: nowIso })
    .execute();
}
log(`Copied ${categoryIdMap.size} categories`);

// 6. extras
const srcExtras = await db
  .selectFrom("extras")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .where("deleted", "is", null)
  .execute();

const extraIdMap = new Map<string, string>();

for (const extra of srcExtras) {
  const newId = randomUUID();
  extraIdMap.set(extra.id as string, newId);
  await db
    .insertInto("extras")
    .values({ id: newId, name: extra.name, price: extra.price, tenant_id: newTenantId, created: nowIso, updated: nowIso })
    .execute();
}
log(`Copied ${extraIdMap.size} extras`);

// 7. products
const srcProducts = await db
  .selectFrom("products")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .where("deleted", "is", null)
  .execute();

const productIdMap = new Map<string, string>();

for (const product of srcProducts) {
  const newId = randomUUID();
  productIdMap.set(product.id as string, newId);
  await db
    .insertInto("products")
    .values({
      id: newId,
      name: product.name,
      price: product.price,
      tags: product.tags,
      tenant_id: newTenantId,
      created: nowIso,
      updated: nowIso,
    })
    .execute();
}
log(`Copied ${productIdMap.size} products`);

// 8. inventory_items
const srcInventoryItems = await db
  .selectFrom("inventory_items")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .where("deleted", "is", null)
  .execute();

const inventoryItemIdMap = new Map<string, string>();

for (const item of srcInventoryItems) {
  const newId = randomUUID();
  inventoryItemIdMap.set(item.id as string, newId);
  await db
    .insertInto("inventory_items")
    .values({
      id: newId,
      name: item.name,
      status: item.status,
      quantity_type_key: item.quantity_type_key,
      tenant_id: newTenantId,
      created: nowIso,
      updated: nowIso,
    })
    .execute();
}
log(`Copied ${inventoryItemIdMap.size} inventory_items`);

// 9. category_inventory_item (junction — no own PK)
const srcCategoryItems = await db
  .selectFrom("category_inventory_item")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .execute();

let categoryItemCount = 0;
for (const ci of srcCategoryItems) {
  const newCategoryId = categoryIdMap.get(ci.category_id);
  const newItemId = inventoryItemIdMap.get(ci.item_id);
  if (!newCategoryId || !newItemId) continue; // skip if either side wasn't copied
  await db
    .insertInto("category_inventory_item")
    .values({ category_id: newCategoryId, item_id: newItemId, tenant_id: newTenantId })
    .execute();
  categoryItemCount++;
}
log(`Copied ${categoryItemCount} category_inventory_item rows`);

// 10. users — create E2E admin + copy remaining source users
// Note: use createUser() which handles permissions::jsonb cast correctly.
const srcUsers = await db
  .selectFrom("users")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .execute();

const { hash: e2eHash, salt: e2eSalt } = hashPassword({ password: E2E_PASSWORD });

let e2eAdminCreated = false;
for (const user of srcUsers) {
  const isFirstAdmin = !e2eAdminCreated && (user.role === "admin" || srcUsers[0] === user);
  if (isFirstAdmin) {
    // Create the designated E2E admin with known credentials
    await createUser({
      tenantId: newTenantId,
      username: E2E_USERNAME,
      role: "admin",
      passwordHash: e2eHash,
      passwordSalt: e2eSalt,
      permissions: ["orders.create", "orders.manage", "products.manage"],
    });
    e2eAdminCreated = true;
  } else {
    // Copy remaining users with a "-test" suffix so usernames stay unique
    await createUser({
      tenantId: newTenantId,
      username: `${user.username}-test`,
      role: user.role,
      passwordHash: user.password_hash,
      passwordSalt: user.password_salt,
      permissions: [],
    });
  }
}
log(`Copied ${srcUsers.length} users (E2E login: ${E2E_USERNAME} / ${E2E_PASSWORD})`);

// 11. Open orders + items + item_extras
const srcOpenOrders = await db
  .selectFrom("orders")
  .selectAll()
  .where("tenant_id", "=", sourceTenantId)
  .where("deleted", "is", null)
  .where("closed", "is", null)
  .limit(MAX_ORDERS)
  .execute();

const orderIdMap = new Map<string, string>();

for (const order of srcOpenOrders) {
  const newOrderId = randomUUID();
  orderIdMap.set(order.id as string, newOrderId);
  await db
    .insertInto("orders")
    .values({
      id: newOrderId,
      position: order.position,
      tenant_id: newTenantId,
      created: nowIso,
      updated: nowIso,
    })
    .execute();
}
log(`Copied ${orderIdMap.size} open orders`);

// order_items
const srcOrderItems = srcOpenOrders.length > 0
  ? await db
      .selectFrom("order_items")
      .selectAll()
      .where("tenant_id", "=", sourceTenantId)
      .where("order_id", "in", srcOpenOrders.map((o) => o.id as string))
      .execute()
  : [];

const orderItemIdMap = new Map<number, number>(); // old int id → new int id

for (const oi of srcOrderItems) {
  const newOrderId = orderIdMap.get(oi.order_id);
  const newProductId = productIdMap.get(oi.product_id);
  const newPaymentOptionId = paymentOptionIdMap.get(oi.payment_option_id as unknown as number) ?? (oi.payment_option_id as unknown as number);
  if (!newOrderId || !newProductId) continue;
  const inserted = await db
    .insertInto("order_items")
    .values({
      order_id: newOrderId,
      product_id: newProductId,
      is_takeaway: oi.is_takeaway,
      payment_option_id: newPaymentOptionId,
      tenant_id: newTenantId,
      created: nowIso,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  orderItemIdMap.set(oi.id as unknown as number, inserted.id as unknown as number);
}
log(`Copied ${orderItemIdMap.size} order_items`);

// order_item_extras
const srcOrderItemExtras = srcOrderItems.length > 0
  ? await db
      .selectFrom("order_item_extras")
      .selectAll()
      .where("tenant_id", "=", sourceTenantId)
      .where("order_item_id", "in", srcOrderItems.map((oi) => oi.id as unknown as number))
      .execute()
  : [];

let extrasCount = 0;
for (const oie of srcOrderItemExtras) {
  const newOrderItemId = orderItemIdMap.get(oie.order_item_id as unknown as number);
  const newExtraId = extraIdMap.get(oie.extra_id);
  if (!newOrderItemId || !newExtraId) continue;
  await db
    .insertInto("order_item_extras")
    .values({
      order_item_id: newOrderItemId,
      extra_id: newExtraId,
      tenant_id: newTenantId,
      created: nowIso,
    })
    .execute();
  extrasCount++;
}
log(`Copied ${extrasCount} order_item_extras`);

// 12. transactions (inventory)
const srcTransactions = inventoryItemIdMap.size > 0
  ? await db
      .selectFrom("transactions")
      .selectAll()
      .where("tenant_id", "=", sourceTenantId)
      .execute()
  : [];

let txCount = 0;
for (const tx of srcTransactions) {
  const newItemId = inventoryItemIdMap.get(tx.item_id);
  if (!newItemId) continue;
  await db
    .insertInto("transactions")
    .values({
      item_id: newItemId,
      type: tx.type,
      price: tx.price as unknown as number,
      quantity: tx.quantity,
      quantity_type_value: tx.quantity_type_value,
      tenant_id: newTenantId,
      created: nowIso,
    })
    .execute();
  txCount++;
}
log(`Copied ${txCount} transactions`);

// ─── Summary ─────────────────────────────────────────────────────────────────

log("");
log("╔══════════════════════════════════════════════════╗");
  log(`║  Tenant "${TARGET_TENANT_NAME}" ready            `);
  log(`║  Tenant ID : ${newTenantId}  `);
  log(`║  E2E login : ${E2E_USERNAME} / ${E2E_PASSWORD}   `);
  log("╚══════════════════════════════════════════════════╝");

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
