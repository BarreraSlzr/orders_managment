/**
 * billingWebhookService — processes platform billing events and updates
 * tenant_subscriptions + tenant_entitlements.
 *
 * Expected event payload shape (provider-agnostic envelope):
 * {
 *   tenantId: string;
 *   provider: string;           // 'mercadopago' | 'stripe' | 'manual'
 *   eventType: string;          // 'subscription.activated' | 'subscription.canceled' | etc.
 *   externalSubscriptionId?: string;
 *   status: TenantSubscriptionStatus;
 *   currentPeriodEnd?: string;  // ISO timestamp
 *   canceledAt?: string;        // ISO timestamp
 *   metadata?: Record<string, unknown>;
 * }
 *
 * Supported eventType values:
 *   subscription.activated   → status: 'active'
 *   subscription.past_due    → status: 'past_due'
 *   subscription.grace_start → status: 'grace_period' (+ grace_period_end)
 *   subscription.canceled    → status: 'canceled'
 *   subscription.expired     → status: 'expired'
 *   subscription.reactivated → status: 'active'
 */
import { createPlatformAlert } from "@/lib/services/alerts/alertsService";
import { getDb, sql } from "@/lib/sql/database";
import { z } from "zod";

/** Grace period in days when no explicit grace_period_end is provided */
const DEFAULT_GRACE_DAYS = 7;

const BillingEventSchema = z.object({
  tenantId: z.string().min(1),
  provider: z.string().min(1),
  eventType: z.string().min(1),
  externalSubscriptionId: z.string().optional(),
  /** Provider-side event id for deduplication (e.g. MP notification `id`). */
  externalEventId: z.string().optional(),
  status: z.enum(["none", "active", "past_due", "grace_period", "canceled", "expired"]),
  currentPeriodEnd: z.string().optional(),
  canceledAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BillingEvent = z.infer<typeof BillingEventSchema>;

/**
 * Validates, processes, and persists a billing webhook event.
 * Updates both tenant_subscriptions and tenant_entitlements.
 */
export async function processBillingEvent(raw: unknown): Promise<void> {
  const parsed = BillingEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[billingWebhook] Invalid payload schema:", parsed.error.flatten());
    return;
  }

  const event = parsed.data;

  // 0. Dedup: skip if this external event was already processed
  if (event.externalEventId) {
    const dup = await getDb()
      .selectFrom("tenant_billing_events")
      .select("id")
      .where("external_event_id", "=", event.externalEventId)
      .executeTakeFirst();

    if (dup) {
      console.info(
        `[billingWebhook] duplicate event skipped: externalEventId=${event.externalEventId}`,
      );
      return;
    }
  }

  // 1. Upsert subscription row (update active row or insert new)
  const existing = await getDb()
    .selectFrom("tenant_subscriptions")
    .select("id")
    .where("tenant_id", "=", event.tenantId)
    .where("provider", "=", event.provider)
    .where("status", "not in", ["canceled", "expired"])
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();

  if (existing) {
    await getDb()
      .updateTable("tenant_subscriptions")
      .set({
        status: event.status,
        external_subscription_id: event.externalSubscriptionId ?? null,
        current_period_end: event.currentPeriodEnd
          ? new Date(event.currentPeriodEnd)
          : null,
        canceled_at: event.canceledAt ? new Date(event.canceledAt) : null,
        metadata: event.metadata ?? null,
        updated_at: sql`now()`,
      })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await getDb()
      .insertInto("tenant_subscriptions")
      .values({
        tenant_id: event.tenantId,
        provider: event.provider,
        external_subscription_id: event.externalSubscriptionId ?? null,
        status: event.status,
        current_period_end: event.currentPeriodEnd
          ? new Date(event.currentPeriodEnd)
          : null,
        canceled_at: event.canceledAt ? new Date(event.canceledAt) : null,
        metadata: event.metadata ?? null,
      })
      .execute();
  }

  // 2. Compute entitlement from new status
  const gracePeriodEnd = computeGracePeriodEnd(event);

  await getDb()
    .insertInto("tenant_entitlements")
    .values({
      tenant_id: event.tenantId,
      subscription_status: event.status,
      features_enabled:
        event.status === "active" || event.status === "grace_period"
          ? ["mercadopago"]
          : [],
      grace_period_end: gracePeriodEnd,
    })
    .onConflict((oc) =>
      oc.column("tenant_id").doUpdateSet({
        subscription_status: event.status,
        features_enabled:
          event.status === "active" || event.status === "grace_period"
            ? ["mercadopago"]
            : [],
        grace_period_end: gracePeriodEnd,
        updated_at: sql`now()`,
      })
    )
    .execute();

  // 3. Append billing event for audit
  await getDb()
    .insertInto("tenant_billing_events")
    .values({
      tenant_id: event.tenantId,
      event_type: event.eventType,
      external_event_id: event.externalEventId ?? null,
      payload: raw as Record<string, unknown>,
    })
    .execute();

  // 4. Create platform alert for actionable billing states
  const alertConfig: Record<
    string,
    { severity: "info" | "warning" | "critical"; title: string; body: string } | undefined
  > = {
    past_due: {
      severity: "warning",
      title: "Pago de suscripción pendiente",
      body: "No se pudo cobrar el plan. Actualiza tu método de pago en Mercado Pago para evitar interrupciones.",
    },
    grace_period: {
      severity: "warning",
      title: "Período de gracia activo",
      body: "Tu suscripción entró en período de gracia. Regulariza el pago para mantener el acceso completo.",
    },
    canceled: {
      severity: "critical",
      title: "Suscripción cancelada",
      body: "El plan fue cancelado. Contacta a soporte si esto fue un error o reactiva la suscripción.",
    },
    expired: {
      severity: "critical",
      title: "Suscripción expirada",
      body: "El plan ha expirado. Algunas funciones pueden estar deshabilitadas hasta que renueves.",
    },
  };

  const alertDef = alertConfig[event.status];
  if (alertDef) {
    await createPlatformAlert({
      tenantId: event.tenantId,
      scope: "tenant",
      type: "subscription",
      severity: alertDef.severity,
      title: alertDef.title,
      body: alertDef.body,
      sourceType: "mp_subscription",
      sourceId: event.externalSubscriptionId,
      metadata: {
        event_type: event.eventType,
        provider: event.provider,
        external_event_id: event.externalEventId,
      },
    });
  }

  console.info(
    `[billingWebhook] tenant=${event.tenantId} provider=${event.provider} event=${event.eventType} status=${event.status}`,
  );
}

function computeGracePeriodEnd(event: BillingEvent): Date | null {
  if (event.status !== "grace_period") return null;
  // If current_period_end provided, add grace days from there; else from now
  const base = event.currentPeriodEnd ? new Date(event.currentPeriodEnd) : new Date();
  const graceEnd = new Date(base);
  graceEnd.setDate(graceEnd.getDate() + DEFAULT_GRACE_DAYS);
  return graceEnd;
}
