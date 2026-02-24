import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Mock all SQL function modules ────────────────────────────────────────────
vi.mock("@/lib/sql/functions/insertOrder", () => ({
  insertOrder: vi.fn(),
}));
vi.mock("@/lib/sql/functions/updateOrderItem", () => ({
  updateOrderItem: vi.fn(),
}));
vi.mock("@/lib/sql/functions/splitOrder", () => ({
  splitOrder: vi.fn(),
}));
vi.mock("@/lib/sql/functions/closeOrder", () => ({
  closeOrder: vi.fn(),
}));
vi.mock("@/lib/sql/functions/updateTakeAway", () => ({
  togglePaymentOption: vi.fn(),
  toggleTakeAway: vi.fn(),
  removeProducts: vi.fn(),
}));
vi.mock("@/lib/sql/functions/upsertProduct", () => ({
  upsertProduct: vi.fn(),
}));
vi.mock("@/lib/sql/functions/inventory", () => ({
  addItem: vi.fn(),
  toggleItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("@/lib/sql/functions/transactions", () => ({
  upsertTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock("@/lib/sql/functions/categories", () => ({
  upsertCategory: vi.fn(),
  deleteCategory: vi.fn(),
  toggleCategoryItem: vi.fn(),
}));
vi.mock("@/lib/sql/functions/extras", () => ({
  upsertExtra: vi.fn(),
  deleteExtra: vi.fn(),
  toggleOrderItemExtra: vi.fn(),
}));
vi.mock("@/lib/sql/functions/adminAudit", () => ({
  createAdminAuditLog: vi.fn(),
}));

// Import after mocks
import { domainEventHandlers } from "@/lib/events/handlers";
import { createAdminAuditLog } from "@/lib/sql/functions/adminAudit";
import {
    deleteCategory,
    toggleCategoryItem,
    upsertCategory,
} from "@/lib/sql/functions/categories";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import {
    deleteExtra,
    toggleOrderItemExtra,
    upsertExtra,
} from "@/lib/sql/functions/extras";
import { insertOrder } from "@/lib/sql/functions/insertOrder";
import {
    addItem,
    deleteItem,
    toggleItem,
} from "@/lib/sql/functions/inventory";
import { splitOrder } from "@/lib/sql/functions/splitOrder";
import {
    deleteTransaction,
    upsertTransaction,
} from "@/lib/sql/functions/transactions";
import { updateOrderItem } from "@/lib/sql/functions/updateOrderItem";
import {
    removeProducts,
    togglePaymentOption,
    toggleTakeAway,
} from "@/lib/sql/functions/updateTakeAway";
import { upsertProduct } from "@/lib/sql/functions/upsertProduct";

describe("domainEventHandlers", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Order events ──────────────────────────────────────────────────────────

  it("order.created → calls insertOrder", async () => {
    const order = { id: "o1", position: 1 };
    (insertOrder as Mock).mockResolvedValue(order as any);

    const result = await domainEventHandlers["order.created"]({
      payload: { tenantId: "t1", timeZone: "America/Mexico_City" },
    });

    expect(insertOrder).toHaveBeenCalledWith({
      tenantId: "t1",
      timeZone: "America/Mexico_City",
    });
    expect(result).toEqual(order);
  });

  it("order.item.updated → calls updateOrderItem", async () => {
    (updateOrderItem as Mock).mockResolvedValue(null);

    await domainEventHandlers["order.item.updated"]({
      payload: { tenantId: "t1", orderId: "o1", productId: "p1", type: "INSERT" },
    });

    expect(updateOrderItem).toHaveBeenCalledWith({
      tenantId: "t1",
      orderId: "o1",
      productId: "p1",
      type: "INSERT",
    });
  });

  it("order.split → calls splitOrder", async () => {
    const splitResult = { newOrder: {}, oldOrder: {} };
    (splitOrder as Mock).mockResolvedValue(splitResult as any);

    const result = await domainEventHandlers["order.split"]({
      payload: { tenantId: "t1", oldOrderId: "o1", itemIds: [1, 2] },
    });

    expect(splitOrder).toHaveBeenCalledWith({
      tenantId: "t1",
      oldOrderId: "o1",
      itemIds: [1, 2],
    });
    expect(result).toEqual(splitResult);
  });

  it("order.closed → calls closeOrder", async () => {
    const closed = { id: "o1" };
    (closeOrder as Mock).mockResolvedValue(closed as any);

    const result = await domainEventHandlers["order.closed"]({
      payload: { tenantId: "t1", orderId: "o1" },
    });

    expect(closeOrder).toHaveBeenCalledWith({ tenantId: "t1", orderId: "o1" });
    expect(result).toEqual(closed);
  });

  it("order.payment.toggled → calls togglePaymentOption", async () => {
    const items = [{ id: 1, product_id: "p1", payment_option_id: 2, is_takeaway: false }];
    (togglePaymentOption as Mock).mockResolvedValue(items as any);

    const result = await domainEventHandlers["order.payment.toggled"]({
      payload: { tenantId: "t1", itemIds: [1] },
    });

    expect(togglePaymentOption).toHaveBeenCalledWith({
      tenantId: "t1",
      itemIds: [1],
    });
    expect(result).toEqual(items);
  });

  it("order.takeaway.toggled → calls toggleTakeAway", async () => {
    const items = [{ id: 1, product_id: "p1", payment_option_id: 1, is_takeaway: true }];
    (toggleTakeAway as Mock).mockResolvedValue(items as any);

    const result = await domainEventHandlers["order.takeaway.toggled"]({
      payload: { tenantId: "t1", itemIds: [1] },
    });

    expect(toggleTakeAway).toHaveBeenCalledWith({
      tenantId: "t1",
      itemIds: [1],
    });
    expect(result).toEqual(items);
  });

  it("order.products.removed → calls removeProducts", async () => {
    const kyleselyResult = [{ numDeletedRows: BigInt(2) }];
    (removeProducts as Mock).mockResolvedValue(kyleselyResult as any);

    const result = await domainEventHandlers["order.products.removed"]({
      payload: { tenantId: "t1", orderId: "o1", itemIds: [1, 2] },
    });

    expect(removeProducts).toHaveBeenCalledWith({
      tenantId: "t1",
      orderId: "o1",
      itemIds: [1, 2],
    });
    // Handler converts BigInt → number for JSON serialization
    expect(result).toEqual([{ numDeletedRows: 2 }]);
  });

  // ── Product events ────────────────────────────────────────────────────────

  it("product.upserted → calls upsertProduct", async () => {
    const product = { id: "p1", name: "Taco", price: 2500, tags: "food" };
    (upsertProduct as Mock).mockResolvedValue(product as any);

    const result = await domainEventHandlers["product.upserted"]({
      payload: { tenantId: "t1", id: "p1", name: "Taco", price: 2500, tags: "food" },
    });

    expect(upsertProduct).toHaveBeenCalledWith({
      tenantId: "t1",
      id: "p1",
      name: "Taco",
      price: 2500,
      tags: "food",
    });
    expect(result).toEqual(product);
  });

  // ── Inventory events ──────────────────────────────────────────────────────

  it("inventory.item.added → calls addItem (no category)", async () => {
    (addItem as Mock).mockResolvedValue({ id: "i1" } as any);

    const result = await domainEventHandlers["inventory.item.added"]({
      payload: { tenantId: "t1", name: "Flour", quantityTypeKey: "weight" },
    });

    expect(addItem).toHaveBeenCalledWith({
      tenantId: "t1",
      name: "Flour",
      quantityTypeKey: "weight",
    });
    expect(result).toEqual({ id: "i1" });
    expect(toggleCategoryItem).not.toHaveBeenCalled();
  });

  it("inventory.item.added → calls addItem + toggleCategoryItem when categoryId provided", async () => {
    (addItem as Mock).mockResolvedValue({ id: "i1" } as any);
    (toggleCategoryItem as Mock).mockResolvedValue("Added");

    const result = await domainEventHandlers["inventory.item.added"]({
      payload: {
        tenantId: "t1",
        name: "Flour",
        quantityTypeKey: "weight",
        categoryId: "c1",
      },
    });

    expect(addItem).toHaveBeenCalledWith({
      tenantId: "t1",
      name: "Flour",
      quantityTypeKey: "weight",
    });
    expect(toggleCategoryItem).toHaveBeenCalledWith({
      tenantId: "t1",
      categoryId: "c1",
      itemId: "i1",
    });
    expect(result).toEqual({ id: "i1", categoryStatus: "Added" });
  });

  it("inventory.item.toggled → calls toggleItem", async () => {
    (toggleItem as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.item.toggled"]({
      payload: { tenantId: "t1", id: "i1" },
    });

    expect(toggleItem).toHaveBeenCalledWith({ tenantId: "t1", id: "i1" });
  });

  it("inventory.item.deleted → calls deleteItem", async () => {
    (deleteItem as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.item.deleted"]({
      payload: { tenantId: "t1", id: "i1" },
    });

    expect(deleteItem).toHaveBeenCalledWith({ tenantId: "t1", id: "i1" });
  });

  // ── Transaction events ────────────────────────────────────────────────────

  it("inventory.transaction.upserted → calls upsertTransaction", async () => {
    (upsertTransaction as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.transaction.upserted"]({
      payload: {
        tenantId: "t1",
        itemId: "i1",
        type: "IN",
        price: 100,
        quantity: 5,
        quantityTypeValue: "kg",
      },
    });

    expect(upsertTransaction).toHaveBeenCalledWith({
      tenantId: "t1",
      itemId: "i1",
      type: "IN",
      price: 100,
      quantity: 5,
      quantityTypeValue: "kg",
      id: undefined,
    });
  });

  it("inventory.transaction.deleted → calls deleteTransaction", async () => {
    (deleteTransaction as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.transaction.deleted"]({
      payload: { tenantId: "t1", id: 99 },
    });

    expect(deleteTransaction).toHaveBeenCalledWith({ tenantId: "t1", id: 99 });
  });

  // ── Category events ───────────────────────────────────────────────────────

  it("inventory.category.upserted → calls upsertCategory", async () => {
    const cat = { id: "c1", name: "Drinks" };
    (upsertCategory as Mock).mockResolvedValue(cat as any);

    const result = await domainEventHandlers["inventory.category.upserted"]({
      payload: { tenantId: "t1", name: "Drinks", id: "c1" },
    });

    expect(upsertCategory).toHaveBeenCalledWith({
      tenantId: "t1",
      name: "Drinks",
      id: "c1",
    });
    expect(result).toEqual(cat);
  });

  it("inventory.category.deleted → calls deleteCategory", async () => {
    (deleteCategory as Mock).mockResolvedValue({ deleted: ["c1"] });

    const result = await domainEventHandlers["inventory.category.deleted"]({
      payload: { tenantId: "t1", id: "c1" },
    });

    expect(deleteCategory).toHaveBeenCalledWith({ tenantId: "t1", id: "c1" });
    expect(result).toEqual({ deleted: ["c1"] });
  });

  it("inventory.category.item.toggled → calls toggleCategoryItem", async () => {
    (toggleCategoryItem as Mock).mockResolvedValue("Added");

    const result = await domainEventHandlers["inventory.category.item.toggled"]({
      payload: { tenantId: "t1", categoryId: "c1", itemId: "i1" },
    });

    expect(toggleCategoryItem).toHaveBeenCalledWith({
      tenantId: "t1",
      categoryId: "c1",
      itemId: "i1",
    });
    expect(result).toBe("Added");
  });

  // ── Extras events ─────────────────────────────────────────────────────────

  it("extra.upserted → calls upsertExtra", async () => {
    const extra = { id: "e1", name: "Cheese", price: 500 };
    (upsertExtra as Mock).mockResolvedValue(extra as any);

    const result = await domainEventHandlers["extra.upserted"]({
      payload: { tenantId: "t1", name: "Cheese", price: 500 },
    });

    expect(upsertExtra).toHaveBeenCalledWith({
      tenantId: "t1",
      id: undefined,
      name: "Cheese",
      price: 500,
    });
    expect(result).toEqual(extra);
  });

  it("extra.deleted → calls deleteExtra", async () => {
    const extra = { id: "e1", name: "Cheese", price: 500 };
    (deleteExtra as Mock).mockResolvedValue(extra as any);

    const result = await domainEventHandlers["extra.deleted"]({
      payload: { tenantId: "t1", id: "e1" },
    });

    expect(deleteExtra).toHaveBeenCalledWith({ tenantId: "t1", id: "e1" });
    expect(result).toEqual(extra);
  });

  it("order.item.extra.toggled → calls toggleOrderItemExtra", async () => {
    const toggleResult = { action: "added" as const, orderItemId: 42, extraId: "e1" };
    (toggleOrderItemExtra as Mock).mockResolvedValue(toggleResult);

    const result = await domainEventHandlers["order.item.extra.toggled"]({
      payload: { tenantId: "t1", orderItemId: 42, extraId: "e1" },
    });

    expect(toggleOrderItemExtra).toHaveBeenCalledWith({
      tenantId: "t1",
      orderItemId: 42,
      extraId: "e1",
    });
    expect(result).toEqual(toggleResult);
  });

  it("admin.audit.logged → calls createAdminAuditLog", async () => {
    const auditResult = { id: 99 };
    (createAdminAuditLog as Mock).mockResolvedValue(auditResult as any);

    const result = await domainEventHandlers["admin.audit.logged"]({
      payload: {
        tenantId: "t1",
        adminId: "admin-1",
        action: "listTenants",
        role: "admin",
        targetTenantId: "t2",
        metadata: { source: "tests" },
      },
    });

    expect(createAdminAuditLog).toHaveBeenCalledWith({
      action: "listTenants",
      adminId: "admin-1",
      role: "admin",
      tenantId: "t1",
      targetTenantId: "t2",
      metadata: { source: "tests" },
    });
    expect(result).toEqual(auditResult);
  });
});
