import { createPlatformAlert } from "@/lib/services/alerts/alertsService";
import { getDb, sql } from "@/lib/sql/database";
import type { FeatureKey } from "@/lib/sql/types";

export interface FeatureGateParams {
  tenantId: string;
  userId: string;
  feature: FeatureKey;
}

export interface FeatureGateService {
  assert(params: FeatureGateParams): Promise<void>;
  has(params: FeatureGateParams): Promise<boolean>;
}

export type FeatureAccessReason =
  | "granted_by_plan"
  | "trial_active"
  | "trial_started"
  | "trial_expired"
  | "feature_not_found";

interface FeatureAccessDecision {
  allowed: boolean;
  reason: FeatureAccessReason;
}

interface ResolvedFeature {
  id: string;
  key: FeatureKey;
  trialDays: number;
}

interface EntitlementState {
  grantedByPlan: boolean;
  trialActive: boolean;
}

interface FeatureGateDeps {
  resolveFeature(params: { feature: FeatureKey }): Promise<ResolvedFeature | null>;
  isFeatureGrantedByPlan(params: { tenantId: string; feature: FeatureKey }): Promise<boolean>;
  syncPlanGrant(params: { tenantId: string; featureId: string; grantedByPlan: boolean }): Promise<void>;
  getEntitlementState(params: { tenantId: string; featureId: string }): Promise<EntitlementState | null>;
  recordFirstUsage(params: {
    tenantId: string;
    userId: string;
    featureId: string;
  }): Promise<{ inserted: boolean }>;
  ensureTrialStamped(params: {
    tenantId: string;
    featureId: string;
    trialDays: number;
  }): Promise<void>;
  emitTrialStartedAlert(params: { tenantId: string; feature: FeatureKey }): Promise<void>;
  emitTrialExpiredAlert(params: { tenantId: string; feature: FeatureKey }): Promise<void>;
}

export function createFeatureGateService(deps: FeatureGateDeps): FeatureGateService {
  return {
    async has(params) {
      const decision = await decideFeatureAccess({ params, deps });
      return decision.allowed;
    },

    async assert(params) {
      const decision = await decideFeatureAccess({ params, deps });
      if (!decision.allowed) {
        throw new Error(`Feature ${params.feature} is not available for tenant ${params.tenantId} (${decision.reason}).`);
      }
    },
  };
}

async function decideFeatureAccess(params: {
  params: FeatureGateParams;
  deps: FeatureGateDeps;
}): Promise<FeatureAccessDecision> {
  const { params: input, deps } = params;

  const resolved = await deps.resolveFeature({ feature: input.feature });
  if (!resolved) {
    return { allowed: false, reason: "feature_not_found" };
  }

  const grantedByPlan = await deps.isFeatureGrantedByPlan({
    tenantId: input.tenantId,
    feature: input.feature,
  });

  await deps.syncPlanGrant({
    tenantId: input.tenantId,
    featureId: resolved.id,
    grantedByPlan,
  });

  if (grantedByPlan) {
    return { allowed: true, reason: "granted_by_plan" };
  }

  let entitlement = await deps.getEntitlementState({
    tenantId: input.tenantId,
    featureId: resolved.id,
  });

  if (entitlement?.trialActive) {
    return { allowed: true, reason: "trial_active" };
  }

  if (!entitlement) {
    const usage = await deps.recordFirstUsage({
      tenantId: input.tenantId,
      userId: input.userId,
      featureId: resolved.id,
    });

    if (usage.inserted) {
      await deps.ensureTrialStamped({
        tenantId: input.tenantId,
        featureId: resolved.id,
        trialDays: resolved.trialDays,
      });

      await deps.emitTrialStartedAlert({
        tenantId: input.tenantId,
        feature: resolved.key,
      });
    }

    entitlement = await deps.getEntitlementState({
      tenantId: input.tenantId,
      featureId: resolved.id,
    });

    if (entitlement?.trialActive) {
      return { allowed: true, reason: usage.inserted ? "trial_started" : "trial_active" };
    }
  }

  await deps.emitTrialExpiredAlert({
    tenantId: input.tenantId,
    feature: resolved.key,
  });

  return { allowed: false, reason: "trial_expired" };
}

const dbDeps: FeatureGateDeps = {
  async resolveFeature({ feature }) {
    const row = await getDb()
      .selectFrom("features")
      .select(["id", "key", "trial_days"])
      .where("key", "=", feature)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      key: row.key,
      trialDays: row.trial_days,
    };
  },

  async isFeatureGrantedByPlan({ tenantId, feature }) {
    const row = await getDb()
      .selectFrom("tenant_entitlements")
      .select("features_enabled")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const enabled = row?.features_enabled ?? [];
    return enabled.includes(feature) || enabled.includes("*") || enabled.includes("all_paid_features");
  },

  async syncPlanGrant({ tenantId, featureId, grantedByPlan }) {
    await getDb()
      .insertInto("feature_entitlements")
      .values({
        tenant_id: tenantId,
        feature_id: featureId,
        granted_by_plan: grantedByPlan,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "feature_id"]).doUpdateSet({
          granted_by_plan: grantedByPlan,
          updated_at: sql`now()`,
        })
      )
      .execute();
  },

  async getEntitlementState({ tenantId, featureId }) {
    const row = await getDb()
      .selectFrom("feature_entitlements")
      .select([
        "granted_by_plan",
        sql<boolean>`COALESCE(trial_ends_at > now(), false)`.as("trial_active"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("feature_id", "=", featureId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      grantedByPlan: row.granted_by_plan,
      trialActive: row.trial_active,
    };
  },

  async recordFirstUsage({ tenantId, userId, featureId }) {
    const inserted = await getDb()
      .insertInto("feature_usage")
      .values({
        tenant_id: tenantId,
        feature_id: featureId,
        initiated_by_user_id: userId,
      })
      .onConflict((oc) => oc.columns(["tenant_id", "feature_id"]).doNothing())
      .returning("id")
      .executeTakeFirst();

    return { inserted: Boolean(inserted?.id) };
  },

  async ensureTrialStamped({ tenantId, featureId, trialDays }) {
    await getDb()
      .insertInto("feature_entitlements")
      .values({
        tenant_id: tenantId,
        feature_id: featureId,
        trial_started_at: sql`now()`,
        trial_ends_at: sql`now() + (${trialDays} * interval '1 day')`,
        granted_by_plan: false,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "feature_id"]).doUpdateSet({
          trial_started_at: sql`COALESCE(feature_entitlements.trial_started_at, now())`,
          trial_ends_at: sql`COALESCE(feature_entitlements.trial_ends_at, now() + (${trialDays} * interval '1 day'))`,
          updated_at: sql`now()`,
        })
      )
      .execute();
  },

  async emitTrialStartedAlert({ tenantId, feature }) {
    const sourceType = "feature_trial";
    const sourceId = `${feature}:started`;

    const existing = await getDb()
      .selectFrom("platform_alerts")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("type", "=", "trial")
      .where("source_type", "=", sourceType)
      .where("source_id", "=", sourceId)
      .where("read_at", "is", null)
      .executeTakeFirst();

    if (existing) return;

    await createPlatformAlert({
      tenantId,
      scope: "tenant",
      type: "trial",
      severity: "info",
      title: `Trial iniciado: ${feature}`,
      body: "Esta funcionalidad quedó habilitada en modo trial para tu tenant.",
      sourceType,
      sourceId,
      metadata: {
        feature,
        phase: "trial_started",
      },
    });
  },

  async emitTrialExpiredAlert({ tenantId, feature }) {
    const sourceType = "feature_trial";
    const sourceId = `${feature}:expired`;

    const existing = await getDb()
      .selectFrom("platform_alerts")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("type", "=", "trial")
      .where("source_type", "=", sourceType)
      .where("source_id", "=", sourceId)
      .where("read_at", "is", null)
      .executeTakeFirst();

    if (existing) return;

    await createPlatformAlert({
      tenantId,
      scope: "tenant",
      type: "trial",
      severity: "critical",
      title: `Trial expirado: ${feature}`,
      body: "El período de prueba terminó para esta funcionalidad. Actualiza tu plan para reactivarla.",
      sourceType,
      sourceId,
      metadata: {
        feature,
        phase: "trial_expired",
      },
    });
  },
};

export const featureGateService = createFeatureGateService(dbDeps);

/**
 * Side-effect-free feature access check for SSR/UI visibility decisions.
 *
 * IMPORTANT:
 * - Does not stamp trial usage
 * - Does not write entitlement rows
 * - Does not emit alerts
 */
export async function peekFeatureAccess(params: {
  tenantId: string;
  feature: FeatureKey;
}): Promise<boolean> {
  const feature = await getDb()
    .selectFrom("features")
    .select(["id", "key"])
    .where("key", "=", params.feature)
    .executeTakeFirst();

  if (!feature) return false;

  const tenantEntitlement = await getDb()
    .selectFrom("tenant_entitlements")
    .select("features_enabled")
    .where("tenant_id", "=", params.tenantId)
    .executeTakeFirst();

  const enabled = tenantEntitlement?.features_enabled ?? [];
  if (
    enabled.includes(params.feature)
    || enabled.includes("*")
    || enabled.includes("all_paid_features")
  ) {
    return true;
  }

  const row = await getDb()
    .selectFrom("feature_entitlements")
    .select([
      "granted_by_plan",
      sql<boolean>`COALESCE(trial_ends_at > now(), false)`.as("trial_active"),
    ])
    .where("tenant_id", "=", params.tenantId)
    .where("feature_id", "=", feature.id)
    .executeTakeFirst();

  return Boolean(row?.granted_by_plan || row?.trial_active);
}
