/**
 * Unit tests for statusService edge-case fix:
 *  - D6: cancelActiveAttempt calls MP API to cancel PDV payment intent
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
  };
  return { db: d, getDb: () => d };
});

const mockCancelPDVPaymentIntent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/services/mercadopago/paymentService", () => ({
  cancelPDVPaymentIntent: (...args: unknown[]) =>
    mockCancelPDVPaymentIntent(...args),
}));

const mockGetCredentials = vi.fn();
vi.mock("@/lib/services/mercadopago/credentialsService", () => ({
  getCredentials: (...args: unknown[]) => mockGetCredentials(...args),
}));

import { db } from "@/lib/sql/database";
import { cancelActiveAttempt } from "../statusService";

describe("cancelActiveAttempt (D6 — PDV cancel via MP API)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no active attempt exists", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

    await cancelActiveAttempt({ orderId: "ord-1", tenantId: "t-1" });

    expect(mockCancelPDVPaymentIntent).not.toHaveBeenCalled();
    // updateTable should NOT be called either (no row to cancel)
    expect(db.updateTable).not.toHaveBeenCalled();
  });

  it("cancels DB row without MP API call when no terminal_id", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      id: 10,
      terminal_id: null,
      mp_transaction_id: null,
    });

    await cancelActiveAttempt({ orderId: "ord-1", tenantId: "t-1" });

    expect(mockCancelPDVPaymentIntent).not.toHaveBeenCalled();
    expect(db.updateTable).toHaveBeenCalledWith("payment_sync_attempts");
  });

  it("calls MP API to cancel PDV intent then marks DB row canceled", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      id: 10,
      terminal_id: "DEVICE-ABC",
      mp_transaction_id: "intent-123",
    });
    mockGetCredentials.mockResolvedValueOnce({
      access_token: "real-token",
    });

    await cancelActiveAttempt({ orderId: "ord-1", tenantId: "t-1" });

    // Should have called the MP API
    expect(mockCancelPDVPaymentIntent).toHaveBeenCalledWith({
      accessToken: "real-token",
      deviceId: "DEVICE-ABC",
      intentId: "intent-123",
    });

    // Should have marked the DB row as canceled
    expect(db.updateTable).toHaveBeenCalledWith("payment_sync_attempts");
  });

  it("still cancels DB row when MP API call fails (best-effort)", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      id: 10,
      terminal_id: "DEVICE-ABC",
      mp_transaction_id: "intent-123",
    });
    mockGetCredentials.mockResolvedValueOnce({
      access_token: "real-token",
    });
    mockCancelPDVPaymentIntent.mockRejectedValueOnce(
      new Error("MP API 500"),
    );

    // Should NOT throw — best-effort
    await cancelActiveAttempt({ orderId: "ord-1", tenantId: "t-1" });

    expect(db.updateTable).toHaveBeenCalledWith("payment_sync_attempts");
  });

  it("skips MP API call when credentials cannot be retrieved", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      id: 10,
      terminal_id: "DEVICE-ABC",
      mp_transaction_id: "intent-123",
    });
    mockGetCredentials.mockResolvedValueOnce(null);

    await cancelActiveAttempt({ orderId: "ord-1", tenantId: "t-1" });

    expect(mockCancelPDVPaymentIntent).not.toHaveBeenCalled();
    expect(db.updateTable).toHaveBeenCalledWith("payment_sync_attempts");
  });
});
