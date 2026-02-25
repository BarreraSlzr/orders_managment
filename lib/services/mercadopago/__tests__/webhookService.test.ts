/**
 * Unit tests for webhookService edge-case fixes:
 *  - B4: timingSafeEqual for HMAC validation
 *  - A5: fetchPaymentDetails error handling (try/catch in handlePaymentEvent)
 *  - D1: AbortController timeout on fetchPaymentDetails
 */
import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/sql/database", () => ({
  db: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    })),
  },
  sql: vi.fn(),
}));

vi.mock("@/lib/services/mercadopago/credentialsService", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    id: 1,
    tenant_id: "t-1",
    access_token: "test-token",
    refresh_token: null,
    user_id: "12345",
    status: "active",
  }),
}));

vi.mock("@/lib/services/mercadopago/statusService", () => ({
  updateAttempt: vi.fn().mockResolvedValue(undefined),
}));

import {
    fetchPaymentDetails,
    handlePaymentEvent,
    validateWebhookSignature,
    type MpWebhookNotification,
} from "../webhookService";

// ─── B4: timingSafeEqual in HMAC validation ────────────────────────────────

describe("validateWebhookSignature (B4 — timing-safe)", () => {
  const secret = "test-webhook-secret-1234";

  function buildSignature(params: {
    dataId: string;
    xRequestId: string;
    ts: string;
    secret: string;
  }): string {
    const segments: string[] = [];
    if (params.dataId) segments.push(`id:${params.dataId}`);
    if (params.xRequestId) segments.push(`request-id:${params.xRequestId}`);
    if (params.ts) segments.push(`ts:${params.ts}`);
    const manifest = segments.join(";") + ";";
    const hmac = createHmac("sha256", params.secret)
      .update(manifest)
      .digest("hex");
    return `ts=${params.ts},v1=${hmac}`;
  }

  it("returns true for a valid signature", () => {
    const ts = "1700000000000";
    const dataId = "pay-123";
    const xRequestId = "req-abc";
    const xSignature = buildSignature({
      dataId,
      xRequestId,
      ts,
      secret,
    });

    expect(
      validateWebhookSignature({ xSignature, xRequestId, dataId, secret }),
    ).toBe(true);
  });

  it("returns false when HMAC does not match", () => {
    const ts = "1700000000000";
    const dataId = "pay-123";
    const xRequestId = "req-abc";
    const xSignature = `ts=${ts},v1=${"a".repeat(64)}`;

    expect(
      validateWebhookSignature({ xSignature, xRequestId, dataId, secret }),
    ).toBe(false);
  });

  it("returns false when hash is missing", () => {
    expect(
      validateWebhookSignature({
        xSignature: "ts=12345",
        xRequestId: "r",
        dataId: "d",
        secret,
      }),
    ).toBe(false);
  });

  it("returns false when ts is missing", () => {
    expect(
      validateWebhookSignature({
        xSignature: "v1=abcdef",
        xRequestId: "r",
        dataId: "d",
        secret,
      }),
    ).toBe(false);
  });

  it("returns false for a non-hex hash (timingSafeEqual buffer length mismatch)", () => {
    expect(
      validateWebhookSignature({
        xSignature: "ts=123,v1=not-hex-at-all!",
        xRequestId: "r",
        dataId: "d",
        secret,
      }),
    ).toBe(false);
  });
});

// ─── D1: AbortController timeout on fetchPaymentDetails ─────────────────────

describe("fetchPaymentDetails (D1 — timeout)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("aborts when the fetch exceeds the timeout", async () => {
    // Mock fetch must honour the AbortSignal — the real fetch rejects
    // with an AbortError when the signal fires, so the mock must too.
    globalThis.fetch = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            });
          }
        }),
    );

    // The 15s timeout is hard-coded in the module. For the test we don't
    // want to wait 15s so we use fake timers.
    vi.useFakeTimers();

    const promise = fetchPaymentDetails({
      accessToken: "tok",
      paymentId: "999",
    });

    // Advance past the 15s timeout — fires controller.abort()
    vi.advanceTimersByTime(16_000);

    await expect(promise).rejects.toThrow(); // AbortError

    vi.useRealTimers();
  });

  it("succeeds when the fetch completes within the timeout", async () => {
    const mockPayment = {
      id: 999,
      status: "approved",
      status_detail: "accredited",
      external_reference: "order-1",
      transaction_amount: 100,
      currency_id: "MXN",
      payment_method_id: "visa",
      date_approved: "2025-01-01T00:00:00.000Z",
      date_created: "2025-01-01T00:00:00.000Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockPayment),
    });

    const result = await fetchPaymentDetails({
      accessToken: "tok",
      paymentId: "999",
    });

    expect(result).toEqual(mockPayment);
  });
});

// ─── A5: handlePaymentEvent catches fetchPaymentDetails errors ──────────────

describe("handlePaymentEvent (A5 — fetch resilience)", () => {
  const originalFetch = globalThis.fetch;

  const baseNotification: MpWebhookNotification = {
    id: 100,
    live_mode: false,
    type: "payment",
    date_created: "2025-01-01T00:00:00.000Z",
    user_id: 12345,
    api_version: "v1",
    action: "payment.created",
    data: { id: "pay-111" },
  };

  beforeEach(() => {
    // Make fetchPaymentDetails throw via a failing fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns handled:false with error detail when fetchPaymentDetails throws", async () => {
    const result = await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(false);
    expect(result.detail).toContain("Failed to fetch payment pay-111");
    expect(result.detail).toContain("Network failure");
  });
});
