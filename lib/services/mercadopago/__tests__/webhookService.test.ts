/**
 * Unit tests for webhookService edge-case fixes:
 *  - B4: timingSafeEqual for HMAC validation
 *  - A5: fetchPaymentDetails error handling (try/catch in handlePaymentEvent)
 *  - D1: AbortController timeout on fetchPaymentDetails
 */
import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  after: (promise: Promise<unknown>) => promise,
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/sql/database", () => {
  const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
  const mockExecute = vi.fn().mockResolvedValue([]);
  const chainable = () => ({
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    executeTakeFirst: mockExecuteTakeFirst,
    execute: mockExecute,
  });
  return {
    db: {
      selectFrom: vi.fn(chainable),
      updateTable: vi.fn(chainable),
    },
    getDb: vi.fn(() => ({
      selectFrom: vi.fn(chainable),
      updateTable: vi.fn(chainable),
    })),
    sql: vi.fn(),
    __mockExecuteTakeFirst: mockExecuteTakeFirst,
  };
});

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

vi.mock("@/lib/services/alerts/alertsService", () => ({
  createPlatformAlert: vi.fn().mockResolvedValue(undefined),
}));

import { createPlatformAlert } from "@/lib/services/alerts/alertsService";
import { getDb } from "@/lib/sql/database";
import {
    fetchPaymentDetails,
    handleMpConnectEvent,
    handlePaymentEvent,
    handlePointIntegrationEvent,
    validateWebhookSignature,
    type MpWebhookNotification,
} from "../webhookService";

  const mockedGetDb = vi.mocked(getDb);

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

  it("returns handled:true when MP reports payment not_found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: vi
        .fn()
        .mockResolvedValue('{"message":"Payment not found","error":"not_found","status":404}'),
    });

    const result = await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(result.detail).toContain("integration-only event acknowledged");
  });
});

// ─── Payment alert with order deep-link ─────────────────────────────────────

describe("handlePaymentEvent — alert with order deep-link", () => {
  const originalFetch = globalThis.fetch;

  const baseNotification: MpWebhookNotification = {
    id: 200,
    live_mode: false,
    type: "payment",
    date_created: "2025-01-01T00:00:00.000Z",
    user_id: 12345,
    api_version: "v1",
    action: "payment.updated",
    data: { id: "pay-200" },
  };

  const mockPayment = {
    id: 200,
    status: "approved",
    status_detail: "accredited",
    external_reference: "order-abc-123",
    transaction_amount: 500,
    currency_id: "MXN",
    payment_method_id: "debit_card",
    date_approved: "2025-01-01T00:00:00.000Z",
    date_created: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockPayment),
    });

    // Mock getDb to return an attempt with terminal_id (PDV flow)
    mockedGetDb.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: "attempt-1",
          tenant_id: "t-1",
          order_id: "order-abc-123",
          status: "pending",
          terminal_id: "TERM-001",
          last_mp_notification_id: null,
        }),
      }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("creates an alert with metadata.order_id for deep-linking", async () => {
    const result = await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t-1",
        type: "payment",
        sourceType: "mp_payment",
        severity: "info",
        metadata: expect.objectContaining({
          order_id: "order-abc-123",
          payment_id: 200,
          mp_status: "approved",
          flow: "pdv",
        }),
      }),
    );
  });

  it("maps rejected status to warning severity", async () => {
    const rejectedPayment = { ...mockPayment, status: "rejected", status_detail: "cc_rejected_other_reason" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(rejectedPayment),
    });

    await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "warning",
        title: expect.stringContaining("Pago rechazado"),
        metadata: expect.objectContaining({ order_id: "order-abc-123" }),
      }),
    );
  });

  it("infers qr flow when terminal_id is null", async () => {
    mockedGetDb.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: "attempt-2",
          tenant_id: "t-1",
          order_id: "order-abc-123",
          status: "pending",
          terminal_id: null,
          last_mp_notification_id: null,
        }),
      }),
    });

    await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ flow: "qr" }),
      }),
    );
  });

  it("acknowledges payment without business attempt", async () => {
    mockedGetDb.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await handlePaymentEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(result.detail).toContain("No active attempt");
  });
});

// ─── Point integration alert with order deep-link ───────────────────────────

describe("handlePointIntegrationEvent — alert with order deep-link", () => {
  const baseNotification: MpWebhookNotification = {
    id: 300,
    live_mode: false,
    type: "point_integration_wh",
    date_created: "2025-01-01T00:00:00.000Z",
    user_id: 12345,
    api_version: "v1",
    action: "state_FINISHED",
    data: { id: "intent-555" },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetDb.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: "attempt-3",
          tenant_id: "t-1",
          order_id: "order-xyz-789",
          status: "processing",
          mp_transaction_id: "intent-555",
          last_mp_notification_id: null,
        }),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates alert with order_id deep-link and pdv flow", async () => {
    const result = await handlePointIntegrationEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t-1",
        type: "payment",
        sourceType: "mp_point",
        severity: "info",
        title: expect.stringContaining("Pago aprobado"),
        metadata: expect.objectContaining({
          order_id: "order-xyz-789",
          mp_intent_id: "intent-555",
          flow: "pdv",
        }),
      }),
    );
  });

  it("maps state_ERROR to critical severity", async () => {
    const errorNotification = {
      ...baseNotification,
      action: "state_ERROR",
    };

    await handlePointIntegrationEvent({
      notification: errorNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
        title: expect.stringContaining("Error en pago"),
      }),
    );
  });

  it("acknowledges point event without matching attempt", async () => {
    mockedGetDb.mockReturnValue({
      selectFrom: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await handlePointIntegrationEvent({
      notification: baseNotification,
      credentials: { access_token: "tok" } as any,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(result.detail).toContain("integration-only event acknowledged");
  });
});

// ─── MP Connect deauth alert ────────────────────────────────────────────────

describe("handleMpConnectEvent — deauth alert", () => {
  const deauthNotification: MpWebhookNotification = {
    id: 400,
    live_mode: false,
    type: "mp-connect",
    date_created: "2025-01-01T00:00:00.000Z",
    user_id: 12345,
    api_version: "v1",
    action: "application.deauthorized",
    data: { id: "12345" },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetDb.mockReturnValue({
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates critical alert without order_id (account-level)", async () => {
    const result = await handleMpConnectEvent({
      notification: deauthNotification,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(result.detail).toBe("Credentials deauthorized");
    expect(createPlatformAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t-1",
        type: "mp_connect",
        severity: "critical",
        title: "Mercado Pago desconectado",
        sourceType: "mp_connect",
        metadata: expect.objectContaining({
          notification_id: 400,
          action: "application.deauthorized",
          user_id: 12345,
        }),
      }),
    );
    // No order_id in metadata
    const mockedAlert = createPlatformAlert as ReturnType<typeof vi.fn>;
    const call = mockedAlert.mock.calls[0][0];
    expect(call.metadata).not.toHaveProperty("order_id");
  });

  it("does not create alert for non-deauth actions", async () => {
    const otherNotification = {
      ...deauthNotification,
      action: "application.authorized",
    };

    const result = await handleMpConnectEvent({
      notification: otherNotification,
      tenantId: "t-1",
    });

    expect(result.handled).toBe(true);
    expect(createPlatformAlert).not.toHaveBeenCalled();
  });
});
