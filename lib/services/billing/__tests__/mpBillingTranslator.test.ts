/**
 * Unit tests for mpBillingTranslator
 *
 * Tests cover:
 *  - subscription_preapproval → BillingEvent translation (all statuses)
 *  - subscription_authorized_payment → BillingEvent for rejected payments
 *  - Non-subscription notification types → null
 *  - Test/simulation events → null
 *  - Missing data.id → null
 *  - Missing external_reference → null
 *  - MP API fetch failure → null (graceful degradation)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFetchSubscriptionDetails = vi.fn();
const mockMpFetch = vi.fn();

vi.mock("@/lib/services/billing/subscriptionService", () => ({
  fetchSubscriptionDetails: (...args: unknown[]) =>
    mockFetchSubscriptionDetails(...args),
}));

vi.mock("@/lib/services/mercadopago/mpFetch", () => ({
  mpFetch: (...args: unknown[]) => mockMpFetch(...args),
}));

import { translateMpBillingNotification } from "../mpBillingTranslator";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_ACCESS_TOKEN = "TEST-billing-token-xyz";

function makeSubDetails(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-123",
    status: "authorized",
    external_reference: "tenant-uuid-abc",
    payer_email: "payer@example.com",
    next_payment_date: "2025-02-01T00:00:00.000-03:00",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("translateMpBillingNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── subscription_preapproval events ──────────────────────────────────────

  describe("subscription_preapproval notifications", () => {
    it("translates an 'authorized' subscription → active BillingEvent", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "authorized" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 12345,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-123" },
          user_id: 204005478,
          live_mode: true,
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe("tenant-uuid-abc");
      expect(result!.provider).toBe("mercadopago");
      expect(result!.eventType).toBe("subscription.updated");
      expect(result!.status).toBe("active");
      expect(result!.externalSubscriptionId).toBe("sub-123");
      expect(result!.externalEventId).toBe("12345");
      expect(result!.currentPeriodEnd).toBe("2025-02-01T00:00:00.000-03:00");

      expect(mockFetchSubscriptionDetails).toHaveBeenCalledWith({
        accessToken: MOCK_ACCESS_TOKEN,
        subscriptionId: "sub-123",
      });
    });

    it("translates a 'pending' subscription → active", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "pending" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 100,
          type: "subscription_preapproval",
          action: "created",
          data: { id: "sub-new" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("active");
      expect(result!.eventType).toBe("subscription.activated");
    });

    it("translates a 'paused' subscription → past_due", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "paused" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 200,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-paused" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("past_due");
    });

    it("translates a 'cancelled' subscription → canceled", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "cancelled" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 300,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-cancelled" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("canceled");
    });

    it("maps unknown MP status to 'none'", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "some_future_status" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 400,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-unknown" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("none");
    });
  });

  // ── subscription_authorized_payment events ───────────────────────────────

  describe("subscription_authorized_payment notifications", () => {
    it("returns null for approved payment (no status change needed)", async () => {
      mockMpFetch.mockResolvedValueOnce({
        id: "pay-1",
        status: "approved",
        preapproval_id: "sub-123",
      });
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "authorized" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 500,
          type: "subscription_authorized_payment",
          action: "created",
          data: { id: "pay-1" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).toBeNull();
    });

    it("translates a rejected payment → past_due", async () => {
      mockMpFetch.mockResolvedValueOnce({
        id: "pay-2",
        status: "rejected",
        preapproval_id: "sub-123",
      });
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ status: "authorized" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 600,
          type: "subscription_authorized_payment",
          action: "updated",
          data: { id: "pay-2" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe("past_due");
      expect(result!.eventType).toBe("subscription.payment_updated");
      expect(result!.tenantId).toBe("tenant-uuid-abc");
    });

    it("returns null when authorized_payment has no preapproval_id", async () => {
      mockMpFetch.mockResolvedValueOnce({
        id: "pay-3",
        status: "rejected",
        // no preapproval_id
      });

      const result = await translateMpBillingNotification({
        payload: {
          id: 700,
          type: "subscription_authorized_payment",
          action: "updated",
          data: { id: "pay-3" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).toBeNull();
    });
  });

  // ── Non-subscription notifications ───────────────────────────────────────

  describe("non-subscription notifications", () => {
    it("returns null for payment type", async () => {
      const result = await translateMpBillingNotification({
        payload: { id: 800, type: "payment", action: "updated", data: { id: "p-1" } },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
      expect(mockFetchSubscriptionDetails).not.toHaveBeenCalled();
    });

    it("returns null for unknown type", async () => {
      const result = await translateMpBillingNotification({
        payload: { id: 900, type: "unknown_type", data: { id: "x" } },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });

    it("returns null for missing type", async () => {
      const result = await translateMpBillingNotification({
        payload: { id: 1000 },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });
  });

  // ── Test/simulation events ───────────────────────────────────────────────

  describe("test events", () => {
    it("returns null for test.created action", async () => {
      const result = await translateMpBillingNotification({
        payload: {
          id: 1100,
          type: "subscription_preapproval",
          action: "test.created",
          data: { id: "test-1" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
      expect(mockFetchSubscriptionDetails).not.toHaveBeenCalled();
    });

    it("returns null for type=test", async () => {
      const result = await translateMpBillingNotification({
        payload: { id: 1200, type: "test", data: { id: "test-2" } },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns null when data.id is missing", async () => {
      const result = await translateMpBillingNotification({
        payload: {
          id: 1300,
          type: "subscription_preapproval",
          action: "updated",
          data: {},
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });

    it("returns null when subscription has no external_reference", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ external_reference: "" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 1400,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-no-ref" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });

    it("returns null when fetchSubscriptionDetails throws", async () => {
      mockFetchSubscriptionDetails.mockRejectedValueOnce(
        new Error("MP API 500"),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 1500,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-fail" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
    });

    it("handles numeric data.id by converting to string", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ id: "12345678" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 1600,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: 12345678 },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(mockFetchSubscriptionDetails).toHaveBeenCalledWith({
        accessToken: MOCK_ACCESS_TOKEN,
        subscriptionId: "12345678",
      });
    });

    it("returns null for subscription_preapproval_plan updates", async () => {
      const result = await translateMpBillingNotification({
        payload: {
          id: 1700,
          type: "subscription_preapproval_plan",
          action: "updated",
          data: { id: "plan-1" },
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result).toBeNull();
      expect(mockFetchSubscriptionDetails).not.toHaveBeenCalled();
    });

    it("includes metadata with MP-specific fields", async () => {
      mockFetchSubscriptionDetails.mockResolvedValueOnce(
        makeSubDetails({ payer_email: "test@mp.com" }),
      );

      const result = await translateMpBillingNotification({
        payload: {
          id: 1800,
          type: "subscription_preapproval",
          action: "updated",
          data: { id: "sub-meta" },
          user_id: 204005478,
          live_mode: false,
        },
        accessToken: MOCK_ACCESS_TOKEN,
      });

      expect(result).not.toBeNull();
      expect(result!.metadata).toEqual(
        expect.objectContaining({
          mp_notification_id: 1800,
          mp_type: "subscription_preapproval",
          mp_action: "updated",
          mp_status: "authorized",
          payer_email: "test@mp.com",
          live_mode: false,
        }),
      );
    });
  });
});
