import { dispatchDomainEventWithDeps } from "../dispatchCore";
import { domainEventHandlers } from "../handlers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createFakeDb() {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ id: 42 });
  const execute = vi.fn().mockResolvedValue([]);

  return {
    executeTakeFirstOrThrow,
    execute,
    db: {
      insertInto: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => ({
            executeTakeFirstOrThrow,
          })),
        })),
      })),
      updateTable: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            execute,
          })),
        })),
      })),
    },
  };
}

describe("dispatchDomainEvent", () => {
  const createHandlers = (handler: ReturnType<typeof vi.fn>) =>
    ({
      "order.created": handler,
      "order.closed": handler,
      "product.upserted": handler,
    }) as unknown as typeof domainEventHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists a pending event, calls the handler, marks processed, and returns the result", async () => {
    const fake = createFakeDb();
    const mockHandlerFn = vi.fn();
    const handlers = createHandlers(mockHandlerFn);
    const expectedResult = { id: "order-uuid", position: 1 };
    mockHandlerFn.mockResolvedValue(expectedResult);

    const result = await dispatchDomainEventWithDeps(
      {
        type: "order.created",
        payload: { tenantId: "t1", timeZone: "America/Mexico_City" },
      },
      { db: fake.db as never, handlers },
    );

    expect(fake.executeTakeFirstOrThrow).toHaveBeenCalledOnce();
    expect(mockHandlerFn).toHaveBeenCalledWith({
      payload: { tenantId: "t1", timeZone: "America/Mexico_City" },
    });
    expect(result).toEqual(expectedResult);
  });

  it("marks the event as failed and rethrows when handler throws", async () => {
    const fake = createFakeDb();
    const mockHandlerFn = vi.fn();
    const handlers = createHandlers(mockHandlerFn);
    const error = new Error("DB connection lost");
    mockHandlerFn.mockRejectedValue(error);

    await expect(
      dispatchDomainEventWithDeps(
        {
          type: "order.closed",
          payload: { tenantId: "t1", orderId: "some-id" },
        },
        { db: fake.db as never, handlers },
      ),
    ).rejects.toThrow("DB connection lost");

    expect(fake.db.updateTable).toHaveBeenCalled();
  });

  it("handles non-Error rejection by storing 'Unknown error'", async () => {
    const fake = createFakeDb();
    const mockHandlerFn = vi.fn();
    const handlers = createHandlers(mockHandlerFn);
    mockHandlerFn.mockRejectedValue("string-error");

    await expect(
      dispatchDomainEventWithDeps(
        {
          type: "order.closed",
          payload: { tenantId: "t1", orderId: "some-id" },
        },
        { db: fake.db as never, handlers },
      ),
    ).rejects.toBe("string-error");

    expect(fake.db.updateTable).toHaveBeenCalled();
  });

  it("dispatches different event types correctly", async () => {
    const fake = createFakeDb();
    const mockHandlerFn = vi.fn();
    const handlers = createHandlers(mockHandlerFn);
    mockHandlerFn.mockResolvedValue({ id: "prod-1", name: "Taco" });

    const result = await dispatchDomainEventWithDeps(
      {
        type: "product.upserted",
        payload: {
          tenantId: "t1",
          name: "Taco",
          price: 2500,
          tags: "food,mexican",
        },
      },
      { db: fake.db as never, handlers },
    );

    expect(result).toEqual({ id: "prod-1", name: "Taco" });
    expect(mockHandlerFn).toHaveBeenCalledWith({
      payload: {
        tenantId: "t1",
        name: "Taco",
        price: 2500,
        tags: "food,mexican",
      },
    });
  });
});
