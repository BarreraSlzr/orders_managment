import { generateTempPassword, hashPassword } from "@/lib/auth/passwords";
import { dispatchDomainEvent } from "@/lib/events/dispatch";
import { getMpPlatformConfig, invalidateMpPlatformConfigCache } from "@/lib/services/mercadopago/platformConfig";
import { exportAllData, getTableCounts, validateSnapshot } from "@/lib/sql/backup";
import { getDb } from "@/lib/sql/database";
import { listAdminAuditLogs } from "@/lib/sql/functions/adminAudit";
import { exportProductsJSON } from "@/lib/sql/functions/exportProductsJSON";
import { getProducts } from "@/lib/sql/functions/getProducts";
import { createTenant, getTenantByName, listTenants } from "@/lib/sql/functions/tenants";
import { createUser, listUsersByTenants } from "@/lib/sql/functions/users";
import { getMigrationStatus } from "@/lib/sql/migrate";
import { allMigrations } from "@/lib/sql/migrations";
import { parseProductsCSV } from "@/lib/utils/parseProductsCSV";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../init";

async function logAdminAccess(params: {
  action: string;
  adminId?: string;
  role?: string;
  tenantId?: string;
  targetTenantId?: string;
  metadata?: Record<string, unknown> | null;
}) {
  if (!params.adminId || !params.tenantId) {
    return;
  }

  await dispatchDomainEvent({
    type: "admin.audit.logged",
    payload: {
      tenantId: params.tenantId,
      adminId: params.adminId,
      role: params.role,
      action: params.action,
      targetTenantId: params.targetTenantId,
      metadata: params.metadata ?? null,
    },
  });
}

export const adminRouter = router({
  /** Check whether the current user has admin privileges */
  status: publicProcedure.query(({ ctx }) => {
    const role = typeof ctx.session?.role === "string" ? ctx.session.role : null;
    const tenantName =
      typeof ctx.session?.tenant_name === "string"
        ? ctx.session.tenant_name
        : null;
    const username =
      typeof ctx.session?.username === "string" ? ctx.session.username : null;
    return {
      isAdmin: ctx.isAdmin,
      role,
      tenantName,
      username,
      session: ctx.session,
    };
  }),

  /** Get current migration status */
  migrationStatus: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "migrationStatus",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getMigrationStatus({ migrations: allMigrations });
  }),

  /** Get row counts for all business tables */
  tableCounts: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "tableCounts",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getTableCounts();
  }),

  /** List all tenants (superadmin) */
  listTenants: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "listTenants",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return listTenants();
  }),

  /** List roster across tenants (system admin) */
  listTenantRoster: adminProcedure
    .input(z.object({ tenantId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session?.tenant_id;
      const tenantName = ctx.session?.tenant_name;

      if (!tenantId || !tenantName) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await logAdminAccess({
        action: "listTenantRoster",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId,
        metadata: {
          filterTenantId: input?.tenantId ?? null,
        },
      });

      const isSystemAdmin = tenantName === "system";
      const visibleRoles = ["manager", "staff"] as const;

      if (!isSystemAdmin) {
        const rows = await listUsersByTenants({
          tenantIds: [tenantId],
          roles: [...visibleRoles],
        });

        return {
          tenants: [
            {
              id: tenantId,
              name: tenantName,
              managers: rows.filter((user) => user.role === "manager"),
              staff: rows.filter((user) => user.role === "staff"),
            },
          ],
        };
      }

      const tenants = await listTenants();
      const targetTenantIds = input?.tenantId
        ? tenants.filter((tenant) => tenant.id === input.tenantId)
        : tenants;

      const tenantIds = targetTenantIds.map((tenant) => tenant.id);
      const rows = await listUsersByTenants({
        tenantIds,
        roles: [...visibleRoles],
      });

      type TenantRosterEntry = {
        id: string;
        name: string;
        managers: typeof rows;
        staff: typeof rows;
      };

      const grouped = new Map<string, TenantRosterEntry>(
        targetTenantIds.map((tenant) => [
          tenant.id,
          { ...tenant, managers: [], staff: [] },
        ])
      );

      for (const user of rows) {
        const entry = grouped.get(user.tenant_id);
        if (!entry) continue;
        if (user.role === "manager") {
          entry.managers.push(user);
        } else {
          entry.staff.push(user);
        }
      }

      return {
        tenants: Array.from(grouped.values()),
      };
    }),

  /** Fetch default tenant (cafe&baguettes) */
  defaultTenant: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "defaultTenant",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return getTenantByName({ name: "cafe&baguettes" });
  }),

  /** Export all data as a JSON snapshot */
  exportData: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "exportData",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });
    return exportAllData();
  }),

  /** List admin audit logs */
  listAuditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        adminId: z.string().min(1).optional(),
        action: z.string().min(1).optional(),
        targetTenantId: z.string().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "listAuditLogs",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        metadata: {
          adminId: input.adminId,
          action: input.action,
          targetTenantId: input.targetTenantId,
          limit: input.limit,
          offset: input.offset,
        },
      });

      return listAdminAuditLogs({
        limit: input.limit,
        offset: input.offset,
        adminId: input.adminId,
        action: input.action,
        targetTenantId: input.targetTenantId,
      });
    }),

  /** Export products for a selected tenant */
  exportTenantProducts: adminProcedure
    .input(z.object({ tenantId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "exportTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const result = await exportProductsJSON({ tenantId: input.tenantId });
      return { json: JSON.stringify(result?.rows || []) };
    }),

  /** List products for a selected tenant */
  listTenantProducts: adminProcedure
    .input(
      z.object({
        tenantId: z.string().min(1),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "listTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
        metadata: {
          search: input.search,
          tags: input.tags,
        },
      });
      return getProducts({
        tenantId: input.tenantId,
        search: input.search,
        tags: input.tags,
      });
    }),

  /** Import products CSV into a selected tenant (merge) */
  importTenantProducts: adminProcedure
    .input(
      z.object({ tenantId: z.string().min(1), csv: z.string().min(1) })
    )
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "importTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      const existing = await getProducts({ tenantId: input.tenantId });
      const existingByName = new Map(
        existing.map((p) => [p.name.toLowerCase(), p])
      );

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const existingProduct = existingByName.get(row.name.toLowerCase());

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: input.tenantId,
              id: row.id ?? existingProduct?.id ?? "",
              name: row.name,
              price: row.price,
              tags: row.tags.replace(/\s*,\s*/g, ","),
            },
          });
          imported++;
        } catch (err) {
          rowErrors.push({
            line: i + 2,
            raw: `${row.name},${row.price},${row.tags}`,
            message:
              err instanceof Error ? err.message : "Unknown upsert error",
          });
          skipped++;
        }
      }

      return {
        imported,
        skipped,
        errors: rowErrors,
        totalLines: parsed.totalLines,
      };
    }),

  /** Reset & import products for a selected tenant */
  resetTenantProducts: adminProcedure
    .input(
      z.object({ tenantId: z.string().min(1), csv: z.string().min(1) })
    )
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "resetTenantProducts",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
      });
      const parsed = parseProductsCSV({ csv: input.csv });

      if (parsed.rows.length === 0) {
        return {
          imported: 0,
          skipped: 0,
          errors: parsed.errors,
          totalLines: parsed.totalLines,
        };
      }

      await getDb()
        .deleteFrom("products")
        .where("tenant_id", "=", input.tenantId)
        .execute();

      let imported = 0;
      let skipped = 0;
      const rowErrors = [...parsed.errors];

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];

        try {
          await dispatchDomainEvent({
            type: "product.upserted",
            payload: {
              tenantId: input.tenantId,
              id: row.id ?? "",
              name: row.name,
              price: row.price,
              tags: row.tags.replace(/\s*,\s*/g, ","),
            },
          });
          imported++;
        } catch (err) {
          rowErrors.push({
            line: i + 2,
            raw: `${row.name},${row.price},${row.tags}`,
            message:
              err instanceof Error ? err.message : "Unknown upsert error",
          });
          skipped++;
        }
      }

      return {
        imported,
        skipped,
        errors: rowErrors,
        totalLines: parsed.totalLines,
      };
    }),

  /** Validate a snapshot without importing it */
  validateSnapshot: adminProcedure
    .input(z.object({ data: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "validateSnapshot",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
      });
      return validateSnapshot({ data: input.data });
    }),

  /** Superadmin onboarding: create tenant + manager user */
  onboardManager: adminProcedure
    .input(
      z.object({
        tenantName: z.string().min(1),
        managerUsername: z.string().min(1),
        tempPassword: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await logAdminAccess({
        action: "onboardManager",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
      });
      const tenant = await createTenant({ name: input.tenantName });
      const tempPassword = input.tempPassword ?? generateTempPassword();
      const { hash, salt } = hashPassword({ password: tempPassword });

      const user = await createUser({
        tenantId: tenant.id,
        username: input.managerUsername,
        role: "manager",
        passwordHash: hash,
        passwordSalt: salt,
      });

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        managerId: user.id,
        username: user.username,
        tempPassword,
      };
    }),

  /** Get admin defaults (payment option, takeaway) for order creation */
  getDefaults: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.tenant_id) {
      // Not authenticated, return fallback defaults
      return {
        defaultPaymentOptionId: 3, // Credit Card
        defaultIsTakeaway: false,
      };
    }

    // In a real app, you'd fetch these from a settings table
    // For now, return hardcoded defaults per tenant
    // TODO: Create admin_settings table with defaults
    return {
      defaultPaymentOptionId: 3, // Credit Card
      defaultIsTakeaway: false,
    };
  }),

  /** Update admin defaults (lazy sync from client) */
  updateDefaults: publicProcedure
    .input(
      z.object({
        defaultPaymentOptionId: z.number().optional(),
        defaultIsTakeaway: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.tenant_id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      // TODO: Save to admin_settings table
      // For now, just log the update
      console.log("Admin defaults updated:", {
        tenantId: ctx.session.tenant_id,
        ...input,
      });

      return { success: true };
    }),

  /**
   * Returns which Mercado Pago platform variables are currently configured.
   * Checks DB (`mp_platform_config`) first, then env vars as fallback.
   * Never exposes actual values — only boolean presence flags.
   */
  mpEnvStatus: adminProcedure.query(async () => {
    try {
      const cfg = await getMpPlatformConfig();

      return {
        ok: true as const,
        vars: {
          MP_CLIENT_ID: Boolean(cfg.clientId),
          MP_CLIENT_SECRET: Boolean(cfg.clientSecret),
          MP_REDIRECT_URI: Boolean(cfg.redirectUri),
          MP_WEBHOOK_SECRET: Boolean(cfg.webhookSecret),
          MP_BILLING_WEBHOOK_SECRET: Boolean(cfg.billingWebhookSecret),
          MP_TOKENS_ENCRYPTION_KEY: Boolean(cfg.tokensEncryptionKey),
        },
      };
    } catch (err) {
      return {
        ok: false as const,
        error: "internal" as const,
        message: err instanceof Error ? err.message : "unknown",
        vars: null,
      };
    }
  }),

  /**
   * Returns a diagnostic summary of all mercadopago_credentials rows.
   *
   * Used to diagnose the P0 production blocker where incoming webhook
   * `user_id` values cannot be resolved to an active tenant credential.
   *
   * Returns:
   *  - rows: all credential rows (non-sensitive fields only — no tokens)
   *  - activeCount: rows with status='active' and deleted IS NULL
   *  - unmappedUserIds: user_ids that appear in inactive/deleted rows but
   *    have no corresponding active row (likely the cause of 'No tenant found')
   */
  mpCredentialHealth: adminProcedure.query(async ({ ctx }) => {
    await logAdminAccess({
      action: "mpCredentialHealth",
      adminId: ctx.session?.sub,
      role: ctx.session?.role,
      tenantId: ctx.session?.tenant_id,
    });

    const rows = await getDb()
      .selectFrom("mercadopago_credentials")
      .select([
        "id",
        "tenant_id",
        "user_id",
        "app_id",
        "contact_email",
        "status",
        "deleted",
        "created",
        "error_message",
      ])
      .orderBy("created", "desc")
      .execute();

    const activeRows = rows.filter((r) => r.status === "active" && r.deleted == null);
    const activeUserIds = new Set(activeRows.map((r) => r.user_id));

    // user_ids that exist in the table but have no active mapping
    const inactiveUserIds = rows
      .filter((r) => r.user_id && !activeUserIds.has(r.user_id))
      .map((r) => r.user_id)
      .filter((id, i, arr) => arr.indexOf(id) === i); // deduplicate

    return {
      rows: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        appId: r.app_id,
        contactEmail: r.contact_email,
        status: r.status,
        deleted: r.deleted,
        created: r.created,
        errorMessage: r.error_message ?? null,
        isActive: r.status === "active" && r.deleted == null,
      })),
      activeCount: activeRows.length,
      inactiveUserIds,
      summary: {
        total: rows.length,
        active: activeRows.length,
        inactive: rows.filter((r) => r.status === "inactive").length,
        error: rows.filter((r) => r.status === "error").length,
        deleted: rows.filter((r) => r.deleted != null).length,
      },
    };
  }),

  /**
   * Upsert a mercadopago_credentials row by tenant_id.
   * Intended for admin reconciliation — insert or patch a credential row
   * without requiring the full OAuth flow (e.g. to map a known MP user_id
   * to an existing tenant so webhook tenant resolution succeeds).
   *
   * NOTE: access_token is stored as provided. In production the token must
   * already be encrypted before submission (or encryption happens here if
   * MP_TOKENS_ENCRYPTION_KEY is set — extend as needed).
   */
  mpCredentialUpsert: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        userId: z.string().min(1),
        appId: z.string().min(1),
        accessToken: z.string().min(1),
        contactEmail: z.string().email().optional(),
        status: z.enum(["active", "inactive", "error"]).default("active"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await logAdminAccess({
        action: "mpCredentialUpsert",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        targetTenantId: input.tenantId,
        metadata: { userId: input.userId, appId: input.appId },
      });

      const row = await getDb()
        .insertInto("mercadopago_credentials")
        .values({
          tenant_id: input.tenantId,
          user_id: input.userId,
          app_id: input.appId,
          access_token: input.accessToken,
          contact_email: input.contactEmail ?? null,
          status: input.status,
          deleted: null,
        })
        .onConflict((oc) =>
          oc.column("tenant_id").doUpdateSet({
            user_id: input.userId,
            app_id: input.appId,
            access_token: input.accessToken,
            contact_email: input.contactEmail ?? null,
            status: input.status,
            deleted: null,
          }),
        )
        .returning([
          "id",
          "tenant_id",
          "user_id",
          "app_id",
          "contact_email",
          "status",
          "created",
        ])
        .executeTakeFirstOrThrow();

      return {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        appId: row.app_id,
        contactEmail: row.contact_email,
        status: row.status,
        created: row.created,
      };
    }),

  /**
   * Upserts the platform-level MP config (client_id, secrets, etc.) into
   * the `mp_platform_config` singleton row in the DB.
   *
   * This replaces the previous "copy .env to Vercel" flow — the app reads
   * from the DB first (with env vars as last-resort fallback) so there's
   * no manual env var management needed after the first deploy.
   */
  mpPlatformConfigUpsert: adminProcedure
    .input(
      z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        redirectUri: z.string().min(1),
        webhookSecret: z.string().min(1),
        billingWebhookSecret: z.string().optional(),
        tokensEncryptionKey: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await logAdminAccess({
        action: "mpPlatformConfigUpsert",
        adminId: ctx.session?.sub,
        role: ctx.session?.role,
        tenantId: ctx.session?.tenant_id,
        metadata: { clientId: input.clientId, redirectUri: input.redirectUri },
      });

      await getDb()
        .updateTable("mp_platform_config")
        .set({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          redirect_uri: input.redirectUri,
          webhook_secret: input.webhookSecret,
          billing_webhook_secret: input.billingWebhookSecret ?? null,
          tokens_encryption_key: input.tokensEncryptionKey ?? null,
          updated_at: new Date().toISOString(),
          updated_by: ctx.session?.sub ?? null,
        })
        .where("id", "=", "singleton")
        .execute();

      invalidateMpPlatformConfigCache();

      return { ok: true as const };
    }),
});

