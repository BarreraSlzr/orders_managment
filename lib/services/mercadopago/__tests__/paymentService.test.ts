/**
 * Unit tests for paymentService edge-case fixes:
 *  - D1: AbortController timeout on mpFetch
 *  - D6: cancelPDVPaymentIntent (best-effort swallow)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    cancelPDVPaymentIntent,
    createPDVPaymentIntent,
    listTerminals,
} from "../paymentService";

describe("paymentService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── D1: mpFetch timeout ────────────────────────────────────────────────

  describe("mpFetch timeout (D1)", () => {
    it("aborts when the MP API hangs past the timeout", async () => {
      // Mock fetch must honour the AbortSignal — reject when abort fires.
      globalThis.fetch = vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(
                  new DOMException("The operation was aborted", "AbortError"),
                );
              });
            }
          }),
      );

      vi.useFakeTimers();

      const promise = listTerminals({ accessToken: "tok" });

      // Advance past the 20s timeout — fires controller.abort()
      vi.advanceTimersByTime(21_000);

      await expect(promise).rejects.toThrow();

      vi.useRealTimers();
    });

    it("succeeds when the API responds within the timeout", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          devices: [{ id: "dev-1", operating_mode: "PDV" }],
        }),
      });

      const result = await listTerminals({ accessToken: "tok" });
      expect(result).toEqual([{ id: "dev-1", operating_mode: "PDV" }]);
    });
  });

  // ── D6: cancelPDVPaymentIntent ─────────────────────────────────────────

  describe("cancelPDVPaymentIntent (D6)", () => {
    it("calls DELETE on the correct MP API endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await cancelPDVPaymentIntent({
        accessToken: "tok",
        deviceId: "DEVICE-1",
        intentId: "intent-xyz",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/orders/intent-xyz",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("swallows errors (best-effort) and does not throw", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("500 Internal Error"));

      // Should not throw
      await expect(
        cancelPDVPaymentIntent({
          accessToken: "tok",
          deviceId: "DEVICE-1",
          intentId: "intent-xyz",
        }),
      ).resolves.toBeUndefined();
    });

    it("swallows non-ok responses without throwing", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: "Not found" }),
      });

      // mpFetch would throw on !res.ok, but cancelPDVPaymentIntent catches it
      await expect(
        cancelPDVPaymentIntent({
          accessToken: "tok",
          deviceId: "DEVICE-1",
          intentId: "intent-xyz",
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── PDV createPDVPaymentIntent (new Orders API) ────────────────────────────

  describe("createPDVPaymentIntent — Orders API v1", () => {
    it("calls POST /v1/orders with decimal amount string", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "order-abc",
          status: "open",
          external_reference: "order-123",
          transactions: { payments: [{ id: "pay-1", amount: "15.00", status: "pending" }] },
        }),
      });

      const result = await createPDVPaymentIntent({
        accessToken: "tok",
        deviceId: "DEVICE-1",
        amountCents: 1500,
        externalReference: "order-123",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/v1/orders",
        expect.objectContaining({ method: "POST" }),
      );

      // Amount must be a decimal string, not an integer
      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const sentBody = JSON.parse(callArgs[1]?.body as string);
      expect(sentBody.transactions.payments[0].amount).toBe("15.00");
      expect(sentBody.config.point.terminal_id).toBe("DEVICE-1");
      expect(sentBody.type).toBe("point");

      expect(result.id).toBe("order-abc");
      expect(result.status).toBe("open");
    });

    it("sends X-Idempotency-Key header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "order-xyz",
          status: "open",
          external_reference: "order-999",
          transactions: { payments: [] },
        }),
      });

      await createPDVPaymentIntent({
        accessToken: "tok",
        deviceId: "DEVICE-1",
        amountCents: 500,
        externalReference: "order-999",
      });

      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const sentHeaders = callArgs[1]?.headers as Record<string, string>;
      expect(sentHeaders["X-Idempotency-Key"]).toBeDefined();
      // Should be a non-empty string (UUID)
      expect(typeof sentHeaders["X-Idempotency-Key"]).toBe("string");
      expect(sentHeaders["X-Idempotency-Key"].length).toBeGreaterThan(0);
    });
  });
});
