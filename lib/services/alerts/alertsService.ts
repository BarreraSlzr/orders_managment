/**
 * alertsService — shared utility for creating and querying platform_alerts.
 *
 * Consumed by:
 *  - webhookService (claim events, subscription state changes)
 *  - billingWebhookService (subscription lifecycle alerts)
 *  - admin tRPC router (changelog / system broadcasts)
 *
 * Alert scopes:
 *   'tenant' → visible only to the owning tenant (+ admins)
 *   'admin'  → visible only to platform admins; tenant_id may be set for context
 *              or NULL for global broadcasts
 */
import { getDb } from "@/lib/sql/database";
import type { AlertScope, AlertSeverity, AlertType, PlatformAlert } from "@/lib/sql/types";

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateAlertParams {
  tenantId: string | null;
  scope: AlertScope;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body?: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a new platform_alert row.
 * Returns the created row id.
 */
export async function createPlatformAlert(params: CreateAlertParams): Promise<string> {
  const {
    tenantId,
    scope,
    type,
    severity,
    title,
    body = "",
    sourceType,
    sourceId,
    metadata,
  } = params;

  const result = await getDb()
    .insertInto("platform_alerts")
    .values({
      tenant_id: tenantId ?? null,
      scope,
      type,
      severity,
      title,
      body,
      source_type: sourceType ?? null,
      source_id: sourceId ?? null,
      metadata: metadata ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return result.id;
}

// ─── Query ───────────────────────────────────────────────────────────────────

export interface ListAlertsParams {
  /** Tenant-scoped alerts. NULL ⇒ admin-only global query (all tenants). */
  tenantId: string | null;
  /** If true, return only unread alerts. */
  unreadOnly?: boolean;
  /** Filter by type. */
  type?: AlertType;
  limit?: number;
  offset?: number;
}

export interface AlertsPage {
  alerts: PlatformAlert[];
  unreadCount: number;
}

export async function listAlerts(params: ListAlertsParams): Promise<AlertsPage> {
  const { tenantId, unreadOnly = false, type, limit = 50, offset = 0 } = params;

  let query = getDb()
    .selectFrom("platform_alerts")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);

  if (tenantId !== null) {
    // Tenant view: own tenant alerts + global (admin-broadcast, tenant_id IS NULL, scope='tenant')
    query = query.where((eb) =>
      eb.or([
        eb("tenant_id", "=", tenantId),
        eb.and([eb("tenant_id", "is", null), eb("scope", "=", "tenant")]),
      ])
    ) as typeof query;
  }

  if (unreadOnly) {
    query = query.where("read_at", "is", null) as typeof query;
  }

  if (type) {
    query = query.where("type", "=", type) as typeof query;
  }

  const alerts = await query.execute();

  // Unread count (same filter, no pagination)
  let countQuery = getDb()
    .selectFrom("platform_alerts")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("read_at", "is", null);

  if (tenantId !== null) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb("tenant_id", "=", tenantId),
        eb.and([eb("tenant_id", "is", null), eb("scope", "=", "tenant")]),
      ])
    ) as typeof countQuery;
  }

  const countRow = await countQuery.executeTakeFirst();
  const unreadCount = Number(countRow?.n ?? 0);

  return { alerts, unreadCount };
}

// ─── Mark read ───────────────────────────────────────────────────────────────

export async function markAlertRead(params: {
  id: string;
  tenantId: string | null;
}): Promise<void> {
  let query = getDb()
    .updateTable("platform_alerts")
    .set({ read_at: new Date() })
    .where("id", "=", params.id)
    .where("read_at", "is", null);

  if (params.tenantId !== null) {
    query = query.where("tenant_id", "=", params.tenantId) as typeof query;
  }

  await query.execute();
}

export async function markAllAlertsRead(params: {
  tenantId: string | null;
  type?: AlertType;
}): Promise<void> {
  let query = getDb()
    .updateTable("platform_alerts")
    .set({ read_at: new Date() })
    .where("read_at", "is", null);

  if (params.tenantId !== null) {
    query = query.where((eb) =>
      eb.or([
        eb("tenant_id", "=", params.tenantId!),
        eb.and([eb("tenant_id", "is", null), eb("scope", "=", "tenant")]),
      ])
    ) as typeof query;
  }

  if (params.type) {
    query = query.where("type", "=", params.type) as typeof query;
  }

  await query.execute();
}
