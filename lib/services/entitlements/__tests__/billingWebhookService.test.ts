/**
 * Unit tests for billingWebhookService edge-case fix:
 *  - C3: Billing event deduplication via externalEventId
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockExecuteTakeFirst = vi.fn();
const mockExecute = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/sql/database", () => {
  const d = {
    selectFrom: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      executeTakeFirst: mockExecuteTakeFirst,
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: mockExecute,
        })),
      })),
    })),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: mockExecute,
        onConflict: vi.fn(() => ({
          column: vi.fn().mockReturnThis(),
          doUpdateSet: vi.fn().mockReturnThis(),
          execute: mockExecute,
        })),
      })),
    })),
  };
  return {
    db: d,
    getDb: () => d,
    sql: Object.assign(vi.fn(() => null), {
      raw: vi.fn(),
    }),
  };
});

import { db } from "@/lib/sql/database";
import { processBillingEvent } from "../billingWebhookService";

describe("processBillingEvent (C3 — deduplication)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validEvent = {
    tenantId: "t-1",
    provider: "mercadopago",
    eventType: "subscription.activated",
    status: "active" as const,
    externalEventId: "mp-notif-12345",
  };

  it("skips processing when externalEventId was already seen", async () => {
    // First selectFrom call = dedup check → found existing row
    mockExecuteTakeFirst.mockResolvedValueOnce({ id: "existing-row" });

    await processBillingEvent(validEvent);

    // insertInto should NOT have been called (event was skipped)
    expect(db.insertInto).not.toHaveBeenCalled();
    // updateTable should NOT have been called
    expect(db.updateTable).not.toHaveBeenCalled();
  });

  it("processes the event when externalEventId is new", async () => {
    // Dedup check → no match
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined);
    // Subscription lookup → no active subscription
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

    await processBillingEvent(validEvent);

    // Should have called insertInto (subscription + entitlement + billing event)
    expect(db.insertInto).toHaveBeenCalled();
  });

  it("processes the event when externalEventId is not provided", async () => {
    const eventWithoutId = {
      tenantId: "t-1",
      provider: "mercadopago",
      eventType: "subscription.activated",
      status: "active" as const,
      // no externalEventId
    };

    // Subscription lookup → no active subscription
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

    await processBillingEvent(eventWithoutId);

    // Should still process — dedup check is skipped when no externalEventId
    expect(db.insertInto).toHaveBeenCalled();
  });

  it("rejects invalid payloads without processing", async () => {
    await processBillingEvent({ tenantId: "" }); // Fails Zod validation

    expect(db.selectFrom).not.toHaveBeenCalled();
    expect(db.insertInto).not.toHaveBeenCalled();
  });
});
