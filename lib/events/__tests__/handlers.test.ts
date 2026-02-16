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
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock("@/lib/sql/functions/categories", () => ({
  upsertCategory: vi.fn(),
  deleteCategory: vi.fn(),
  toggleCategoryItem: vi.fn(),
}));

// Import after mocks
import { domainEventHandlers } from "@/lib/events/handlers";
import {
    deleteCategory,
    toggleCategoryItem,
    upsertCategory,
} from "@/lib/sql/functions/categories";
import { closeOrder } from "@/lib/sql/functions/closeOrder";
import { insertOrder } from "@/lib/sql/functions/insertOrder";
import {
    addItem,
    deleteItem,
    toggleItem,
} from "@/lib/sql/functions/inventory";
import { splitOrder } from "@/lib/sql/functions/splitOrder";
import {
    addTransaction,
    deleteTransaction,
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
      payload: { timeZone: "America/Mexico_City" },
    });

    expect(insertOrder).toHaveBeenCalledWith("America/Mexico_City");
    expect(result).toEqual(order);
  });

  it("order.item.updated → calls updateOrderItem", async () => {
    (updateOrderItem as Mock).mockResolvedValue(null);

    await domainEventHandlers["order.item.updated"]({
      payload: { orderId: "o1", productId: "p1", type: "INSERT" },
    });

    expect(updateOrderItem).toHaveBeenCalledWith("o1", "p1", "INSERT");
  });

  it("order.split → calls splitOrder", async () => {
    const splitResult = { newOrder: {}, oldOrder: {} };
    (splitOrder as Mock).mockResolvedValue(splitResult as any);

    const result = await domainEventHandlers["order.split"]({
      payload: { oldOrderId: "o1", itemIds: [1, 2] },
    });

    expect(splitOrder).toHaveBeenCalledWith({
      old_order_id: "o1",
      item_ids: [1, 2],
    });
    expect(result).toEqual(splitResult);
  });

  it("order.closed → calls closeOrder", async () => {
    const closed = { id: "o1" };
    (closeOrder as Mock).mockResolvedValue(closed as any);

    const result = await domainEventHandlers["order.closed"]({
      payload: { orderId: "o1" },
    });

    expect(closeOrder).toHaveBeenCalledWith("o1");
    expect(result).toEqual(closed);
  });

  it("order.payment.toggled → calls togglePaymentOption", async () => {
    const items = [{ id: 1, product_id: "p1", payment_option_id: 2, is_takeaway: false }];
    (togglePaymentOption as Mock).mockResolvedValue(items as any);

    const result = await domainEventHandlers["order.payment.toggled"]({
      payload: { itemIds: [1] },
    });

    expect(togglePaymentOption).toHaveBeenCalledWith([1]);
    expect(result).toEqual(items);
  });

  it("order.takeaway.toggled → calls toggleTakeAway", async () => {
    const items = [{ id: 1, product_id: "p1", payment_option_id: 1, is_takeaway: true }];
    (toggleTakeAway as Mock).mockResolvedValue(items as any);

    const result = await domainEventHandlers["order.takeaway.toggled"]({
      payload: { itemIds: [1] },
    });

    expect(toggleTakeAway).toHaveBeenCalledWith([1]);
    expect(result).toEqual(items);
  });

  it("order.products.removed → calls removeProducts", async () => {
    const deleted = [{ numDeletedRows: BigInt(2) }];
    (removeProducts as Mock).mockResolvedValue(deleted as any);

    const result = await domainEventHandlers["order.products.removed"]({
      payload: { orderId: "o1", itemIds: [1, 2] },
    });

    expect(removeProducts).toHaveBeenCalledWith("o1", [1, 2]);
    expect(result).toEqual(deleted);
  });

  // ── Product events ────────────────────────────────────────────────────────

  it("product.upserted → calls upsertProduct", async () => {
    const product = { id: "p1", name: "Taco", price: 2500, tags: "food" };
    (upsertProduct as Mock).mockResolvedValue(product as any);

    const result = await domainEventHandlers["product.upserted"]({
      payload: { id: "p1", name: "Taco", price: 2500, tags: "food" },
    });

    expect(upsertProduct).toHaveBeenCalledWith({
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
      payload: { name: "Flour", quantityTypeKey: "weight" },
    });

    expect(addItem).toHaveBeenCalledWith("Flour", "weight");
    expect(result).toEqual({ id: "i1" });
    expect(toggleCategoryItem).not.toHaveBeenCalled();
  });

  it("inventory.item.added → calls addItem + toggleCategoryItem when categoryId provided", async () => {
    (addItem as Mock).mockResolvedValue({ id: "i1" } as any);
    (toggleCategoryItem as Mock).mockResolvedValue("Added");

    const result = await domainEventHandlers["inventory.item.added"]({
      payload: { name: "Flour", quantityTypeKey: "weight", categoryId: "c1" },
    });

    expect(addItem).toHaveBeenCalledWith("Flour", "weight");
    expect(toggleCategoryItem).toHaveBeenCalledWith("c1", "i1");
    expect(result).toEqual({ id: "i1", categoryStatus: "Added" });
  });

  it("inventory.item.toggled → calls toggleItem", async () => {
    (toggleItem as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.item.toggled"]({
      payload: { id: "i1" },
    });

    expect(toggleItem).toHaveBeenCalledWith("i1");
  });

  it("inventory.item.deleted → calls deleteItem", async () => {
    (deleteItem as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.item.deleted"]({
      payload: { id: "i1" },
    });

    expect(deleteItem).toHaveBeenCalledWith("i1");
  });

  // ── Transaction events ────────────────────────────────────────────────────

  it("inventory.transaction.added → calls addTransaction", async () => {
    (addTransaction as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.transaction.added"]({
      payload: {
        itemId: "i1",
        type: "IN",
        price: 100,
        quantity: 5,
        quantityTypeValue: "kg",
      },
    });

    expect(addTransaction).toHaveBeenCalledWith("i1", "IN", 100, 5, "kg");
  });

  it("inventory.transaction.deleted → calls deleteTransaction", async () => {
    (deleteTransaction as Mock).mockResolvedValue(undefined as any);

    await domainEventHandlers["inventory.transaction.deleted"]({
      payload: { id: 99 },
    });

    expect(deleteTransaction).toHaveBeenCalledWith(99);
  });

  // ── Category events ───────────────────────────────────────────────────────

  it("inventory.category.upserted → calls upsertCategory", async () => {
    const cat = { id: "c1", name: "Drinks" };
    (upsertCategory as Mock).mockResolvedValue(cat as any);

    const result = await domainEventHandlers["inventory.category.upserted"]({
      payload: { name: "Drinks", id: "c1" },
    });

    expect(upsertCategory).toHaveBeenCalledWith("Drinks", "c1");
    expect(result).toEqual(cat);
  });

  it("inventory.category.deleted → calls deleteCategory", async () => {
    (deleteCategory as Mock).mockResolvedValue({ deleted: ["c1"] });

    const result = await domainEventHandlers["inventory.category.deleted"]({
      payload: { id: "c1" },
    });

    expect(deleteCategory).toHaveBeenCalledWith("c1");
    expect(result).toEqual({ deleted: ["c1"] });
  });

  it("inventory.category.item.toggled → calls toggleCategoryItem", async () => {
    (toggleCategoryItem as Mock).mockResolvedValue("Added");

    const result = await domainEventHandlers["inventory.category.item.toggled"]({
      payload: { categoryId: "c1", itemId: "i1" },
    });

    expect(toggleCategoryItem).toHaveBeenCalledWith("c1", "i1");
    expect(result).toBe("Added");
  });
});
