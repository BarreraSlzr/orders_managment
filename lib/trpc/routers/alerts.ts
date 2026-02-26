/**
 * alerts tRPC router — platform_alerts CRUD.
 *
 * Tenant procedures use the session tenant_id automatically.
 * Admin procedures can query admin-scoped alerts and broadcast
 * changelog / system notices to all tenants.
 */
import {
    createPlatformAlert,
    listAlerts,
    markAlertRead,
    markAllAlertsRead,
} from "@/lib/services/alerts/alertsService";
import { getDb } from "@/lib/sql/database";
import type { AlertType } from "@/lib/sql/types";
import { z } from "zod";
import { adminProcedure, router, tenantProcedure } from "../init";

const AlertTypeSchema = z.enum(["claim", "payment", "mp_connect", "subscription", "changelog", "system"]);

export const alertsRouter = router({
  /**
   * List alerts for the current tenant.
   * Returns the page + unread count for badge display.
   */
  list: tenantProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        type: AlertTypeSchema.optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listAlerts({
        tenantId: ctx.tenantId,
        unreadOnly: input.unreadOnly,
        type: input.type as AlertType | undefined,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /** Mark a single alert as read (tenant must own it). */
  markRead: tenantProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await markAlertRead({ id: input.id, tenantId: ctx.tenantId });
    }),

  /** Mark all alerts of an optional type as read for the current tenant. */
  markAllRead: tenantProcedure
    .input(z.object({ type: AlertTypeSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await markAllAlertsRead({
        tenantId: ctx.tenantId,
        type: input.type as AlertType | undefined,
      });
    }),

  // ── Admin ───────────────────────────────────────────────────────────────

  /**
   * List admin-scoped alerts (claims cc'd to admin, subscription events, etc.)
   * Optionally filtered by tenantId to drill into a specific account's alerts.
   */
  adminList: adminProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        type: AlertTypeSchema.optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      // Admin view: query admin-scope OR global alerts
      let query = getDb()
        .selectFrom("platform_alerts")
        .selectAll()
        .where("scope", "=", "admin")
        .orderBy("created_at", "desc")
        .limit(input.limit ?? 50)
        .offset(input.offset ?? 0);

      if (input.tenantId) {
        query = query.where("tenant_id", "=", input.tenantId) as typeof query;
      }
      if (input.unreadOnly) {
        query = query.where("read_at", "is", null) as typeof query;
      }
      if (input.type) {
        query = query.where("type", "=", input.type) as typeof query;
      }

      const alerts = await query.execute();

      const countRow = await getDb()
        .selectFrom("platform_alerts")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("scope", "=", "admin")
        .where("read_at", "is", null)
        .executeTakeFirst();

      return { alerts, unreadCount: Number(countRow?.n ?? 0) };
    }),

  /** Mark a single admin alert as read. */
  adminMarkRead: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await markAlertRead({ id: input.id, tenantId: null });
    }),

  /** Mark all admin alerts as read. */
  adminMarkAllRead: adminProcedure
    .input(z.object({ type: AlertTypeSchema.optional() }))
    .mutation(async ({ input }) => {
      await markAllAlertsRead({
        tenantId: null,
        type: input.type as AlertType | undefined,
      });
    }),

  /**
   * Broadcast a changelog or system notice to all tenants.
   * Creates a single row with tenant_id=NULL, scope='tenant' so it appears
   * in every tenant's Notifications tab.
   */
  broadcast: adminProcedure
    .input(
      z.object({
        type: z.enum(["changelog", "system"]),
        severity: z.enum(["info", "warning", "critical"]).default("info"),
        title: z.string().min(1).max(200),
        body: z.string().max(2000).default(""),
        sourceType: z.string().optional(),
        sourceId: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createPlatformAlert({
        tenantId: null,
        scope: "tenant",
        type: input.type,
        severity: input.severity,
        title: input.title,
        body: input.body,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        metadata: input.metadata,
      });
      return { id };
    }),
});
