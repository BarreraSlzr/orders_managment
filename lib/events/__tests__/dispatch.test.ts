import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the database layer ──────────────────────────────────────────────────
const mockExecuteTakeFirstOrThrow = vi.fn();
const mockExecute = vi.fn();

vi.mock("@/lib/sql/database", () => ({
  db: {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
        })),
      })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: mockExecute,
        })),
      })),
    })),
  },
}));

// ── Mock handlers ────────────────────────────────────────────────────────────
const mockHandlerFn = vi.fn();
vi.mock("@/lib/events/handlers", () => ({
  domainEventHandlers: new Proxy(
    {},
    {
      get: () => mockHandlerFn,
    }
  ),
}));

describe("dispatchDomainEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteTakeFirstOrThrow.mockResolvedValue({ id: 42 });
    mockExecute.mockResolvedValue([]);
  });

  it("persists a pending event, calls the handler, marks processed, and returns the result", async () => {
    const expectedResult = { id: "order-uuid", position: 1 };
    mockHandlerFn.mockResolvedValue(expectedResult);

    const result = await dispatchDomainEvent({
      type: "order.created",
      payload: { timeZone: "America/Mexico_City" },
    });

    // Event was inserted
    expect(mockExecuteTakeFirstOrThrow).toHaveBeenCalledOnce();

    // Handler was called with the payload
    expect(mockHandlerFn).toHaveBeenCalledWith({
      payload: { timeZone: "America/Mexico_City" },
    });

    // Result is returned
    expect(result).toEqual(expectedResult);
  });

  it("marks the event as failed and rethrows when handler throws", async () => {
    const error = new Error("DB connection lost");
    mockHandlerFn.mockRejectedValue(error);

    await expect(
      dispatchDomainEvent({
        type: "order.closed",
        payload: { orderId: "some-id" },
      })
    ).rejects.toThrow("DB connection lost");
  });

  it("handles non-Error rejection by storing 'Unknown error'", async () => {
    mockHandlerFn.mockRejectedValue("string-error");

    await expect(
      dispatchDomainEvent({
        type: "order.closed",
        payload: { orderId: "some-id" },
      })
    ).rejects.toBe("string-error");
  });

  it("dispatches different event types correctly", async () => {
    mockHandlerFn.mockResolvedValue({ id: "prod-1", name: "Taco" });

    const result = await dispatchDomainEvent({
      type: "product.upserted",
      payload: { name: "Taco", price: 2500, tags: "food,mexican" },
    });

    expect(result).toEqual({ id: "prod-1", name: "Taco" });
    expect(mockHandlerFn).toHaveBeenCalledWith({
      payload: { name: "Taco", price: 2500, tags: "food,mexican" },
    });
  });
});
