/**
 * Unit tests for refundService — MP refund operations.
 *
 * Covers:
 *  - createRefund: full refund (no amount), partial refund (with amount)
 *  - X-Idempotency-Key header on creation
 *  - listRefunds: GET returns array
 *  - getRefund: GET specific refund
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRefund, getRefund, listRefunds } from "../refundService";

describe("refundService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── createRefund ────────────────────────────────────────────────────────

  describe("createRefund", () => {
    it("POST /v1/payments/{id}/refunds for full refund (no body.amount)", async () => {
      const mockRefund = {
        id: 1001,
        payment_id: 555,
        amount: 100,
        status: "approved",
        date_created: "2024-01-01T00:00:00Z",
        source: { id: "s", name: "n", type: "t" },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockRefund),
      });

      const result = await createRefund({
        accessToken: "tok",
        paymentId: "555",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/payments/555/refunds",
        expect.objectContaining({ method: "POST" }),
      );

      // Full refund → no body (or empty body)
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = call[1]?.body;
      // undefined body or no amount key
      if (sentBody) {
        const parsed = JSON.parse(sentBody as string);
        expect(parsed.amount).toBeUndefined();
      }

      expect(result.id).toBe(1001);
      expect(result.status).toBe("approved");
    });

    it("includes amount in body for partial refund", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 1002,
          payment_id: 555,
          amount: 25.5,
          status: "approved",
        }),
      });

      await createRefund({
        accessToken: "tok",
        paymentId: "555",
        amount: 25.5,
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.amount).toBe(25.5);
    });

    it("sends X-Idempotency-Key header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 1003,
          payment_id: 555,
          amount: 10,
          status: "approved",
        }),
      });

      await createRefund({
        accessToken: "tok",
        paymentId: "555",
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentHeaders = call[1]?.headers as Record<string, string>;
      expect(sentHeaders["X-Idempotency-Key"]).toBeDefined();
      expect(typeof sentHeaders["X-Idempotency-Key"]).toBe("string");
      expect(sentHeaders["X-Idempotency-Key"].length).toBeGreaterThan(0);
    });
  });

  // ── listRefunds ─────────────────────────────────────────────────────────

  describe("listRefunds", () => {
    it("GET /v1/payments/{id}/refunds returns array", async () => {
      const mockRefunds = [
        { id: 1, payment_id: 100, amount: 50, status: "approved" },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockRefunds),
      });

      const result = await listRefunds({
        accessToken: "tok",
        paymentId: "100",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/payments/100/refunds",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  // ── getRefund ───────────────────────────────────────────────────────────

  describe("getRefund", () => {
    it("GET /v1/payments/{id}/refunds/{refundId} returns single refund", async () => {
      const mockRefund = {
        id: 42,
        payment_id: 100,
        amount: 10,
        status: "approved",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockRefund),
      });

      const result = await getRefund({
        accessToken: "tok",
        paymentId: "100",
        refundId: "42",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/payments/100/refunds/42",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.id).toBe(42);
    });
  });

  // ── Error propagation ──────────────────────────────────────────────────

  it("throws when refund is rejected by MP", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        message: "Payment not eligible for refund",
      }),
    });

    await expect(
      createRefund({ accessToken: "tok", paymentId: "999" }),
    ).rejects.toThrow("Payment not eligible for refund");
  });
});
