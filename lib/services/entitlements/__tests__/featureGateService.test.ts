import type { FeatureKey } from "@/lib/sql/types";
import { describe, expect, it, vi } from "vitest";
import { createFeatureGateService } from "../featureGateService";

interface EntitlementState {
  grantedByPlan: boolean;
  trialActive: boolean;
}

interface ResolvedFeature {
  id: string;
  key: FeatureKey;
  trialDays: number;
}

function makeDeps(params?: {
  resolvedFeature?: ResolvedFeature | null;
  grantedByPlan?: boolean;
  entitlementSequence?: Array<EntitlementState | null>;
  recordFirstUsageInserted?: boolean;
}) {
  const entitlementSequence = [...(params?.entitlementSequence ?? [])];

  return {
    resolveFeature: vi.fn(async () => params?.resolvedFeature ?? {
      id: "f-order-expenses",
      key: "order_expenses" as const,
      trialDays: 30,
    }),
    isFeatureGrantedByPlan: vi.fn(async () => params?.grantedByPlan ?? false),
    syncPlanGrant: vi.fn(async () => undefined),
    getEntitlementState: vi.fn(async () => {
      if (entitlementSequence.length === 0) return null;
      return entitlementSequence.shift() ?? null;
    }),
    recordFirstUsage: vi.fn(async () => ({ inserted: params?.recordFirstUsageInserted ?? true })),
    ensureTrialStamped: vi.fn(async () => undefined),
    emitTrialStartedAlert: vi.fn(async () => undefined),
    emitTrialExpiredAlert: vi.fn(async () => undefined),
  };
}

const baseParams = {
  tenantId: "tenant-1",
  userId: "user-1",
  feature: "order_expenses" as const,
};

describe("featureGateService", () => {
  it("Case 1 — starts trial on first feature use", async () => {
    const deps = makeDeps({
      entitlementSequence: [null, { grantedByPlan: false, trialActive: true }],
      recordFirstUsageInserted: true,
    });
    const service = createFeatureGateService(deps);

    const has = await service.has(baseParams);

    expect(has).toBe(true);
    expect(deps.recordFirstUsage).toHaveBeenCalledTimes(1);
    expect(deps.ensureTrialStamped).toHaveBeenCalledTimes(1);
    expect(deps.emitTrialStartedAlert).toHaveBeenCalledTimes(1);
  });

  it("Case 2 — denies access when trial is expired", async () => {
    const deps = makeDeps({
      entitlementSequence: [{ grantedByPlan: false, trialActive: false }],
    });
    const service = createFeatureGateService(deps);

    const has = await service.has(baseParams);

    expect(has).toBe(false);
    expect(deps.emitTrialExpiredAlert).toHaveBeenCalledTimes(1);
  });

  it("Case 3 — plan override grants access", async () => {
    const deps = makeDeps({
      grantedByPlan: true,
      entitlementSequence: [{ grantedByPlan: true, trialActive: false }],
    });
    const service = createFeatureGateService(deps);

    const has = await service.has(baseParams);

    expect(has).toBe(true);
    expect(deps.syncPlanGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      featureId: "f-order-expenses",
      grantedByPlan: true,
    });
    expect(deps.emitTrialExpiredAlert).not.toHaveBeenCalled();
  });

  it("Case 4 — downgrade falls back to active trial", async () => {
    const deps = makeDeps({
      grantedByPlan: false,
      entitlementSequence: [{ grantedByPlan: false, trialActive: true }],
    });
    const service = createFeatureGateService(deps);

    const has = await service.has(baseParams);

    expect(has).toBe(true);
    expect(deps.syncPlanGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      featureId: "f-order-expenses",
      grantedByPlan: false,
    });
  });

  it("Case 5 — duplicate first-use race stays idempotent", async () => {
    const deps = makeDeps({
      entitlementSequence: [null, { grantedByPlan: false, trialActive: true }],
      recordFirstUsageInserted: false,
    });
    const service = createFeatureGateService(deps);

    const has = await service.has(baseParams);

    expect(has).toBe(true);
    expect(deps.ensureTrialStamped).not.toHaveBeenCalled();
    expect(deps.emitTrialStartedAlert).not.toHaveBeenCalled();
  });

  it("assert throws with feature-scoped denial reason", async () => {
    const deps = makeDeps({
      entitlementSequence: [{ grantedByPlan: false, trialActive: false }],
    });
    const service = createFeatureGateService(deps);

    await expect(service.assert(baseParams)).rejects.toThrow("trial_expired");
  });
});
