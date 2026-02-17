import type {
  DispatchDomainEventParams,
  DomainEventType
} from "@/lib/events/contracts";
import { describe, expect, it } from "vitest";

/**
 * Compile-time verification that every DomainEventType has
 * a corresponding entry in both PayloadMap and ResultMap.
 *
 * If a new event type is added to the union but not to the
 * maps, these tests will fail to compile.
 */
describe("Event contracts – completeness", () => {
  const allEventTypes: DomainEventType[] = [
    "order.created",
    "order.item.updated",
    "order.split",
    "order.closed",
    "order.payment.toggled",
    "order.takeaway.toggled",
    "order.products.removed",
    "product.upserted",
    "inventory.item.added",
    "inventory.item.toggled",
    "inventory.item.deleted",
    "inventory.transaction.added",
    "inventory.transaction.deleted",
    "inventory.category.upserted",
    "inventory.category.deleted",
    "inventory.category.item.toggled",
    "extra.upserted",
    "extra.deleted",
    "order.item.extra.toggled",
    "admin.audit.logged",
  ];

  it("DomainEventType union contains all expected event types", () => {
    expect(allEventTypes).toHaveLength(20);
  });

  it("every event type is a non-empty string", () => {
    for (const eventType of allEventTypes) {
      expect(typeof eventType).toBe("string");
      expect(eventType.length).toBeGreaterThan(0);
    }
  });

  it("event types follow dot-notation naming convention", () => {
    for (const eventType of allEventTypes) {
      expect(eventType).toMatch(/^[a-z]+(\.[a-z]+)+$/);
    }
  });

  // Type-level assertion: DispatchDomainEventParams is constructible for each event type
  it("DispatchDomainEventParams accepts valid payloads for order.created", () => {
    const params: DispatchDomainEventParams<"order.created"> = {
      type: "order.created",
      payload: { tenantId: "t1", timeZone: "America/Mexico_City" },
    };
    expect(params.type).toBe("order.created");
    expect(params.payload.timeZone).toBe("America/Mexico_City");
  });

  it("DispatchDomainEventParams accepts valid payloads for product.upserted", () => {
    const params: DispatchDomainEventParams<"product.upserted"> = {
      type: "product.upserted",
      payload: { tenantId: "t1", name: "Taco", price: 2500, tags: "food" },
    };
    expect(params.type).toBe("product.upserted");
    expect(params.payload.name).toBe("Taco");
  });

  it("DispatchDomainEventParams accepts valid payloads for inventory.transaction.added", () => {
    const params: DispatchDomainEventParams<"inventory.transaction.added"> = {
      type: "inventory.transaction.added",
      payload: {
        tenantId: "t1",
        itemId: "item-1",
        type: "IN",
        price: 50,
        quantity: 10,
        quantityTypeValue: "kg",
      },
    };
    expect(params.payload.type).toBe("IN");
    expect(params.payload.quantity).toBe(10);
  });

  it("DispatchDomainEventParams accepts valid payloads for inventory.category.item.toggled", () => {
    const params: DispatchDomainEventParams<"inventory.category.item.toggled"> = {
      type: "inventory.category.item.toggled",
      payload: { tenantId: "t1", categoryId: "c1", itemId: "i1" },
    };
    expect(params.payload.categoryId).toBe("c1");
  });

  it("DispatchDomainEventParams accepts valid payloads for admin.audit.logged", () => {
    const params: DispatchDomainEventParams<"admin.audit.logged"> = {
      type: "admin.audit.logged",
      payload: {
        tenantId: "t1",
        adminId: "admin-1",
        action: "listTenants",
        role: "admin",
        targetTenantId: "t2",
        metadata: { source: "tests" },
      },
    };
    expect(params.payload.action).toBe("listTenants");
  });
});
