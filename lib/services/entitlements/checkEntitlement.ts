/**
 * checkEntitlement — tenant Mercado Pago feature gate.
 *
 * The entitlement soft-gate is enabled only when the
 * ENTITLEMENT_ENABLED=true environment variable is set.  When disabled
 * (the default) all tenants are allowed through so existing deployments
 * are unaffected until the billing infrastructure is ready.
 *
 * See docs/MERCADOPAGO_ENTITLEMENT_ARCHITECTURE.md for the full design.
 */
import { getDb } from "@/lib/sql/database";
import { TenantSubscriptionStatus } from "@/lib/sql/types";

export interface EntitlementResult {
  allowed: boolean;
  /** Machine-readable reason when not allowed */
  reason?: TenantSubscriptionStatus | "entitlement_disabled";
}

/** Statuses that allow Mercado Pago operational features */
const ALLOWED_STATUSES: TenantSubscriptionStatus[] = ["active", "grace_period"];

/**
 * Checks whether a tenant is allowed to use Mercado Pago features.
 *
 * When `ENTITLEMENT_ENABLED` is not `"true"` this always returns
 * `{ allowed: true, reason: "entitlement_disabled" }` so no existing
 * tenant is blocked while billing is not yet wired.
 *
 * @example
 * const { allowed, reason } = await checkMpEntitlement({ tenantId });
 * if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: reason });
 */
export async function checkMpEntitlement({
  tenantId,
}: {
  tenantId: string;
}): Promise<EntitlementResult> {
  // Gate is opt-in — default is to allow everyone
  if (process.env.ENTITLEMENT_ENABLED !== "true") {
    return { allowed: true, reason: "entitlement_disabled" };
  }

  const ent = await getDb()
    .selectFrom("tenant_entitlements")
    .select(["subscription_status", "grace_period_end"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  if (!ent) {
    return { allowed: false, reason: "none" };
  }

  const status = ent.subscription_status as TenantSubscriptionStatus;

  if (!ALLOWED_STATUSES.includes(status)) {
    return { allowed: false, reason: status };
  }

  // Grace period may have passed even though the row still says grace_period
  if (status === "grace_period" && ent.grace_period_end) {
    if (new Date(ent.grace_period_end) < new Date()) {
      // Write-through: advance the DB row so dashboards and queries stay
      // consistent. Fire-and-forget — do not block the gate check.
      getDb().updateTable("tenant_entitlements")
        .set({
          subscription_status: "expired",
          features_enabled: [],
        })
        .where("tenant_id", "=", tenantId)
        .where("subscription_status", "=", "grace_period")
        .execute()
        .catch((err) =>
          console.warn("[entitlement] grace-period auto-expire write-through failed:", err),
        );

      return { allowed: false, reason: "expired" };
    }
  }

  return { allowed: true };
}

/**
 * Returns a user-facing Spanish message for a blocked entitlement reason.
 * Use this in API routes that return redirect responses with UI messages.
 */
export function mpEntitlementMessage(
  reason: TenantSubscriptionStatus | "entitlement_disabled",
): string {
  switch (reason) {
    case "none":
      return "Necesitas una suscripción activa para conectar Mercado Pago.";
    case "past_due":
      return "Tu suscripción tiene un pago pendiente. Regularízala para continuar usando Mercado Pago.";
    case "grace_period":
      return "Tu período de gracia ha terminado. Actualiza tu método de pago para habilitar los pagos.";
    case "canceled":
    case "expired":
      return "Tu suscripción fue cancelada. Renueva para volver a habilitar los pagos con Mercado Pago.";
    default:
      return "Los pagos con Mercado Pago no están disponibles con tu plan actual.";
  }
}
