import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPreapprovalPlan, createSubscription } from "../subscriptionService";

const fetchMock = vi.fn();

globalThis.fetch = fetchMock as unknown as typeof fetch;

describe("subscriptionService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("creates a preapproval plan", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "plan_123" }),
    });

    const result = await createPreapprovalPlan({
      accessToken: "token",
      reason: "Orders Management — Plan Mensual",
      transactionAmount: 299,
      currencyId: "MXN",
      backUrl: "https://orders.internetfriends.xyz/onboardings/configure-mp-billing",
    });

    expect(result.id).toBe("plan_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/preapproval_plan");
    expect(init.method).toBe("POST");

    const body = JSON.parse(String(init.body));
    expect(body.auto_recurring.currency_id).toBe("MXN");
    expect(body.auto_recurring.transaction_amount).toBe(299);
  });

  it("creates a subscription from a plan", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "sub_123", status: "pending", init_point: "https://mp/init" }),
    });

    const result = await createSubscription({
      accessToken: "token",
      preapprovalPlanId: "plan_123",
      payerEmail: "tenant@example.com",
      externalReference: "tenant-id-1",
      backUrl: "https://orders.internetfriends.xyz/onboardings/configure-mp-billing",
      reason: "Orders Management — Plan Mensual",
    });

    expect(result.id).toBe("sub_123");
    expect(result.init_point).toBe("https://mp/init");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/preapproval");
    const body = JSON.parse(String(init.body));
    expect(body.preapproval_plan_id).toBe("plan_123");
    expect(body.external_reference).toBe("tenant-id-1");
  });
});