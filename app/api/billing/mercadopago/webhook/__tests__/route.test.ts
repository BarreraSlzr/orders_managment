/**
 * Unit tests for /api/billing/mercadopago/webhook/route.ts
 *
 * Tests cover:
 *  - HMAC signature validation (valid / invalid / missing secret)
 *  - JSON parse error handling
 *  - processBillingEvent error handling
 *  - Always-200 contract (prevents retry storms)
 */
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockProcessBillingEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/services/entitlements/billingWebhookService", () => ({
  processBillingEvent: (...args: unknown[]) => mockProcessBillingEvent(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-billing-secret-xyz-1234";
const TEST_REQUEST_ID = "req-abc-123";

/**
 * Builds a valid x-signature header for the given body, requestId and secret.
 * Matches the manifest format: body:{body};request-id:{id};ts:{ts};
 */
function buildSignature(params: {
  rawBody: string;
  xRequestId: string;
  ts: string;
  secret: string;
}): string {
  const { rawBody, xRequestId, ts, secret } = params;
  const segments: string[] = [];
  if (rawBody) segments.push(`body:${rawBody}`);
  if (xRequestId) segments.push(`request-id:${xRequestId}`);
  if (ts) segments.push(`ts:${ts}`);
  const manifest = segments.join(";") + ";";
  const hex = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hex}`;
}

function makeRequest(params: {
  body: string;
  xSignature?: string;
  xRequestId?: string;
}): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.xSignature) headers["x-signature"] = params.xSignature;
  if (params.xRequestId) headers["x-request-id"] = params.xRequestId;

  return new NextRequest("https://example.com/api/billing/mercadopago/webhook", {
    method: "POST",
    body: params.body,
    headers,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("/api/billing/mercadopago/webhook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockProcessBillingEvent.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── HMAC validation / MP_BILLING_WEBHOOK_SECRET set ──────────────────────

  describe("when MP_BILLING_WEBHOOK_SECRET is set", () => {
    beforeEach(() => {
      process.env.MP_BILLING_WEBHOOK_SECRET = TEST_SECRET;
    });

    it("accepts a valid HMAC signature and processes the event", async () => {
      const payload = JSON.stringify({ type: "subscription_preapproval", action: "updated", data: { id: "sub-1" } });
      const ts = String(Date.now());
      const xSignature = buildSignature({
        rawBody: payload,
        xRequestId: TEST_REQUEST_ID,
        ts,
        secret: TEST_SECRET,
      });

      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: payload, xSignature, xRequestId: TEST_REQUEST_ID }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
      expect(mockProcessBillingEvent).toHaveBeenCalledOnce();
    });

    it("rejects an invalid HMAC with received:true + error:invalid_signature (status 200)", async () => {
      const payload = JSON.stringify({ type: "subscription_preapproval", action: "updated" });
      const ts = String(Date.now());

      // Tamper: compute with the wrong secret
      const xSignature = buildSignature({
        rawBody: payload,
        xRequestId: TEST_REQUEST_ID,
        ts,
        secret: "wrong-secret",
      });

      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: payload, xSignature, xRequestId: TEST_REQUEST_ID }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true, error: "invalid_signature" });
      expect(mockProcessBillingEvent).not.toHaveBeenCalled();
    });

    it("rejects a tampered body (signature mismatch)", async () => {
      const original = JSON.stringify({ type: "subscription_preapproval", data: { id: "sub-1" } });
      const tampered = JSON.stringify({ type: "subscription_preapproval", data: { id: "INJECTED" } });
      const ts = String(Date.now());

      // Signature computed over original body, but tampered body sent
      const xSignature = buildSignature({
        rawBody: original,
        xRequestId: TEST_REQUEST_ID,
        ts,
        secret: TEST_SECRET,
      });

      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: tampered, xSignature, xRequestId: TEST_REQUEST_ID }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true, error: "invalid_signature" });
      expect(mockProcessBillingEvent).not.toHaveBeenCalled();
    });

    it("rejects a missing x-signature header", async () => {
      const payload = JSON.stringify({ type: "subscription_preapproval" });

      const { POST } = await import("../route");
      // No xSignature header → empty string → ts/hash parse fails → false
      const response = await POST(makeRequest({ body: payload, xRequestId: TEST_REQUEST_ID }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true, error: "invalid_signature" });
      expect(mockProcessBillingEvent).not.toHaveBeenCalled();
    });
  });

  // ── Signature skipped when MP_BILLING_WEBHOOK_SECRET is absent ───────────

  describe("when MP_BILLING_WEBHOOK_SECRET is NOT set (dev mode)", () => {
    beforeEach(() => {
      delete process.env.MP_BILLING_WEBHOOK_SECRET;
    });

    it("skips HMAC validation and processes the event", async () => {
      const payload = JSON.stringify({ type: "subscription_preapproval", action: "created" });

      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: payload }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
      expect(mockProcessBillingEvent).toHaveBeenCalledOnce();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    beforeEach(() => {
      delete process.env.MP_BILLING_WEBHOOK_SECRET;
    });

    it("returns 200 with received:true when JSON body is malformed", async () => {
      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: "NOT-JSON{{" }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
      expect(mockProcessBillingEvent).not.toHaveBeenCalled();
    });

    it("returns 200 even when processBillingEvent throws", async () => {
      mockProcessBillingEvent.mockRejectedValueOnce(new Error("DB connection failed"));

      const payload = JSON.stringify({ type: "subscription_preapproval" });
      const { POST } = await import("../route");
      const response = await POST(makeRequest({ body: payload }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
    });
  });
});
